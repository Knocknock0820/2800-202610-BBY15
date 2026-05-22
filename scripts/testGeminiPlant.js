#!/usr/bin/env node

require("dotenv").config();

const fs = require("fs");
const path = require("path");

const API_KEY = process.env.GEMINI_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite";
const IMAGES_ROOT = path.join(__dirname, "..", "public", "images", "details");
const DESCRIPTIONS_ROOT = path.join(__dirname, "..", "public", "descriptions");

const DEFAULT_PLANT = "monstera deliciosa";

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^-+|-+$/g, "");
}

function buildEndpoint(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(API_KEY)}`;
}

function extractText(parts) {
  return parts
    .map((part) => part.text || part?.text?.toString?.() || "")
    .join("\n")
    .trim();
}

function buildUnsplashSearchUrl(query, page = 1, perPage = 10) {
  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("page", String(page));
  url.searchParams.set("orientation", "portrait");
  url.searchParams.set("content_filter", "high");
  return url;
}

function buildPlantVariantQuery(plantName, variant) {
  const queries = {
    hero: `${plantName} houseplant indoor photo`,
    seed: `${plantName} seed photo`,
    sprout: `${plantName} sprout young plant photo`,
    mature: `${plantName} mature plant leaves photo`,
    flower: `${plantName} flowering bloom photo`,
    harvest: `${plantName} fruit photo`,
  };

  return queries[variant] || `${plantName} plant photo`;
}

async function searchUnsplashPhoto(query, usedPhotoIds = new Set()) {
  if (!UNSPLASH_ACCESS_KEY) {
    throw new Error(
      "Missing UNSPLASH_ACCESS_KEY. Add it to your environment or .env file.",
    );
  }

  for (let page = 1; page <= 3; page += 1) {
    const response = await fetch(buildUnsplashSearchUrl(query, page, 10), {
      headers: {
        Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        "Accept-Version": "v1",
      },
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(
        payload?.errors?.[0] || payload?.error || "Unsplash search failed",
      );
    }

    const results = payload.results || [];
    const uniquePhoto = results.find(
      (item) => item?.id && !usedPhotoIds.has(item.id),
    );

    if (uniquePhoto) {
      return uniquePhoto;
    }
  }

  throw new Error(`No unique Unsplash photo found for query "${query}".`);
}

async function registerUnsplashDownload(photo) {
  if (!photo?.links?.download_location) {
    return;
  }

  await fetch(photo.links.download_location, {
    headers: {
      Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
      "Accept-Version": "v1",
    },
  });
}

async function downloadImage(imageUrl, outputPath) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download image: ${response.status} ${response.statusText}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(outputPath, fileBuffer);
}

function extractErrorMessage(payload) {
  if (!payload) {
    return "Unknown Gemini API error";
  }

  if (payload.error?.message) {
    return payload.error.message;
  }

  if (payload.promptFeedback?.blockReason) {
    return `Prompt blocked: ${payload.promptFeedback.blockReason}`;
  }

  return JSON.stringify(payload);
}

async function callGemini(model, body, retries = 0, maxRetries = 3) {
  const response = await fetch(buildEndpoint(model), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json();

  if (!response.ok) {
    const errorMsg = extractErrorMessage(payload);

    // Check if it's a quota/rate limit error
    const isQuotaError =
      errorMsg.includes("quota") ||
      errorMsg.includes("limit") ||
      response.status === 429;

    if (isQuotaError && retries < maxRetries) {
      const waitTime = Math.pow(2, retries) * 1000 + Math.random() * 1000; // Exponential backoff
      console.log(
        `Rate limited. Retrying in ${Math.ceil(waitTime / 1000)}s (attempt ${retries + 1}/${maxRetries})...`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return callGemini(model, body, retries + 1, maxRetries);
    }

    throw new Error(errorMsg);
  }

  return payload;
}

async function generateDescription(plantName) {
  const prompt = [
    `Create a comprehensive Markdown care guide for the plant "${plantName}" similar to a professional botanical wiki.`,
    "Include the following sections: Overview, Light, Water, Soil, Common Problems (as a table), and Pet Safety.",
    "Use professional, helpful formatting with headers (##), bold text, and bullet points.",
  ].join(" ");

  const payload = await callGemini(TEXT_MODEL, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
  });

  const candidate = payload.candidates?.[0];
  if (!candidate) {
    throw new Error(
      "No candidate in response: " + JSON.stringify(payload, null, 2),
    );
  }

  const parts = candidate?.content?.parts || [];
  const description = extractText(parts);

  if (!description) {
    throw new Error(
      "No text in parts. Finish reason: " + candidate.finishReason,
    );
  }

  return description;
}

async function generateImage(plantName, variant, outputPath, usedPhotoIds) {
  const primaryQuery = buildPlantVariantQuery(plantName, variant);

  let photo;
  try {
    photo = await searchUnsplashPhoto(primaryQuery, usedPhotoIds);
  } catch {
    photo = await searchUnsplashPhoto(`${plantName} plant photo`, usedPhotoIds);
  }

  const imageUrl = photo.urls?.regular || photo.urls?.full || photo.urls?.small;

  if (!imageUrl) {
    throw new Error(
      `Unsplash returned no downloadable image for "${plantName}" (${variant}).`,
    );
  }

  if (photo.id) {
    usedPhotoIds.add(photo.id);
  }

  await registerUnsplashDownload(photo);
  await downloadImage(imageUrl, outputPath);

  return {
    imageText:
      photo.alt_description ||
      photo.description ||
      photo.user?.name ||
      "Unsplash plant photo",
    photographer: photo.user?.name || "Unknown photographer",
    photoUrl: photo.links?.html || photo.urls?.regular,
  };
}

async function generatePlantImages(plantName, slug) {
  const plantImagesDir = path.join(IMAGES_ROOT, slug);
  fs.mkdirSync(plantImagesDir, { recursive: true });
  const usedPhotoIds = new Set();

  const variants = [
    { key: "hero", fileName: `${slug}.jpg` },
    { key: "seed", fileName: `${slug}_seed.jpg` },
    { key: "sprout", fileName: `${slug}_sprout.jpg` },
    { key: "mature", fileName: `${slug}_mature.jpg` },
    { key: "flower", fileName: `${slug}_flower.jpg` },
    { key: "harvest", fileName: `${slug}_harvest.jpg` },
  ];

  const results = {};

  for (const variant of variants) {
    const outputPath = path.join(plantImagesDir, variant.fileName);
    const imageInfo = await generateImage(
      plantName,
      variant.key,
      outputPath,
      usedPhotoIds,
    );

    results[variant.key] = {
      path: outputPath,
      ...imageInfo,
    };

    console.log(`Saved ${variant.key} image: ${outputPath}`);
    console.log(`Photo credit: ${imageInfo.photographer}`);
  }

  return results;
}

async function main() {
  if (!API_KEY) {
    console.error(
      "Missing GEMINI_API_KEY. Add it to your environment or .env file.",
    );
    process.exitCode = 1;
    return;
  }

  const args = process.argv.slice(2).filter((arg) => arg.trim().length > 0);
  const plantName = args[0] || DEFAULT_PLANT;
  const slug = slugify(args[1] || plantName) || "plant";

  fs.mkdirSync(IMAGES_ROOT, { recursive: true });
  fs.mkdirSync(DESCRIPTIONS_ROOT, { recursive: true });

  const descriptionPath = path.join(DESCRIPTIONS_ROOT, `${slug}.md`);

  console.log(`Testing Gemini with plant: ${plantName}`);

  try {
    console.log("Generating images...");
    await generatePlantImages(plantName, slug);

    console.log("Generating description...");
    const description = await generateDescription(plantName);
    await fs.writeFileSync(descriptionPath, `${description}\n`, "utf8");
    console.log(`Description saved to: ${descriptionPath}`);

    console.log("\nDescription:\n");
    console.log(description);
  } catch (error) {
    console.error(`Gemini test failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
