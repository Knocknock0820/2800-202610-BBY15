#!/usr/bin/env node

require("dotenv").config();

const fs = require("fs");
const path = require("path");

const API_KEY = process.env.GEMINI_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite";
const OUTPUT_DIR = path.join(__dirname, "gemini-output");

const DEFAULT_PLANT = "monstera deliciosa";

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
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

function buildUnsplashSearchUrl(plantName) {
  const query = `${plantName} plant`;
  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("orientation", "portrait");
  url.searchParams.set("content_filter", "high");
  return url;
}

async function searchUnsplashPhoto(plantName) {
  if (!UNSPLASH_ACCESS_KEY) {
    throw new Error(
      "Missing UNSPLASH_ACCESS_KEY. Add it to your environment or .env file.",
    );
  }

  const response = await fetch(buildUnsplashSearchUrl(plantName), {
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

  const photo = payload.results?.[0];
  if (!photo) {
    throw new Error(`No Unsplash photo found for "${plantName}".`);
  }

  return photo;
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

async function generateImage(plantName, outputPath) {
  const photo = await searchUnsplashPhoto(plantName);
  const imageUrl = photo.urls?.regular || photo.urls?.full || photo.urls?.small;

  if (!imageUrl) {
    throw new Error(
      `Unsplash returned no downloadable image for "${plantName}".`,
    );
  }

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

async function main() {
  if (!API_KEY) {
    console.error(
      "Missing GEMINI_API_KEY. Add it to your environment or .env file.",
    );
    process.exitCode = 1;
    return;
  }

  const plantName = process.argv.slice(2).join(" ").trim() || DEFAULT_PLANT;
  const slug = slugify(plantName) || "plant";

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const descriptionPath = path.join(OUTPUT_DIR, `${slug}-description.txt`);
  const imagePath = path.join(OUTPUT_DIR, `${slug}-image.png`);

  console.log(`Testing Gemini with plant: ${plantName}`);

  try {
    console.log("Generating image...");
    const imageInfo = await generateImage(plantName, imagePath);
    console.log(`Image saved to: ${imagePath}`);
    console.log(`Photo credit: ${imageInfo.photographer}`);

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
