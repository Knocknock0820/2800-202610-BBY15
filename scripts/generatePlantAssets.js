/**
 * Generate Plant Assets (Description + Images)
 *
 * This module generates plant descriptions and images entirely in-memory,
 * uploads them directly to Cloudinary, and updates MongoDB.
 * No temporary files are written to disk.
 *
 * Exported functions:
 * - generatePlantAssets(slug, plantName, waterFreq, difficulty, plantCollection, options)
 */

require("dotenv").config();

const cloudinary = require("cloudinary").v2;

const API_KEY = process.env.GEMINI_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite";
const TOTAL_PROGRESS_STEPS = 8;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

function reportProgress(onProgress, current, message) {
  if (typeof onProgress === "function") {
    onProgress({
      current,
      total: TOTAL_PROGRESS_STEPS,
      message,
    });
  }
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
      const waitTime = Math.pow(2, retries) * 1000 + Math.random() * 1000;
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

async function generateDescription(plantName, onProgress) {
  const prompt = [
    `Create a comprehensive Markdown care guide for the plant "${plantName}" similar to a professional botanical wiki.`,
    "Include the following sections: Overview, Light, Water,Humidity & Temperature, Soil, Support & Growth, Common Problems (as a table), and Pet Safety.",
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

  reportProgress(onProgress, 1, `Description generated for ${plantName}.`);

  return description;
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

async function downloadImageAsBuffer(imageUrl) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download image: ${response.status} ${response.statusText}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function generateImageBuffers(plantName, slug, onProgress) {
  const usedPhotoIds = new Set();
  const variants = [
    { key: "hero", fileName: `${slug}.jpg` },
    { key: "seed", fileName: `${slug}_seed.jpg` },
    { key: "sprout", fileName: `${slug}_sprout.jpg` },
    { key: "mature", fileName: `${slug}_mature.jpg` },
    { key: "flower", fileName: `${slug}_flower.jpg` },
    { key: "harvest", fileName: `${slug}_harvest.jpg` },
  ];

  const imageBuffers = {};

  for (let index = 0; index < variants.length; index += 1) {
    const variant = variants[index];
    const primaryQuery = buildPlantVariantQuery(plantName, variant.key);

    let photo;
    try {
      photo = await searchUnsplashPhoto(primaryQuery, usedPhotoIds);
    } catch {
      photo = await searchUnsplashPhoto(
        `${plantName} plant photo`,
        usedPhotoIds,
      );
    }

    const imageUrl =
      photo.urls?.regular || photo.urls?.full || photo.urls?.small;

    if (!imageUrl) {
      throw new Error(
        `Unsplash returned no downloadable image for "${plantName}" (${variant.key}).`,
      );
    }

    if (photo.id) {
      usedPhotoIds.add(photo.id);
    }

    await registerUnsplashDownload(photo);
    const buffer = await downloadImageAsBuffer(imageUrl);

    imageBuffers[variant.key] = {
      buffer,
      fileName: variant.fileName,
      photographer: photo.user?.name || "Unknown photographer",
    };

    console.log(`Generated ${variant.key} image for ${plantName}`);
    reportProgress(
      onProgress,
      index + 2,
      `Generated ${variant.key} image for ${plantName}.`,
    );
  }

  return imageBuffers;
}

async function uploadImageBufferToCloudinary(buffer, fileName, publicId) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "plant-types",
        public_id: publicId,
        overwrite: true,
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result.secure_url);
        }
      },
    );

    uploadStream.end(buffer);
  });
}

async function uploadAssetsToDatabase(
  slug,
  plantName,
  imageBuffers,
  description,
  waterFreq,
  difficulty,
  plantCollection,
  onProgress,
) {
  try {
    reportProgress(
      onProgress,
      7,
      `Uploading generated assets for ${plantName}...`,
    );

    // Upload all images to Cloudinary
    console.log("Uploading images to Cloudinary...");
    const heroUrl = await uploadImageBufferToCloudinary(
      imageBuffers.hero.buffer,
      `${slug}.jpg`,
      `${slug}/${slug}`,
    );

    const lifecycleImages = {};
    const stages = ["seed", "sprout", "mature", "flower", "harvest"];

    for (const stage of stages) {
      if (imageBuffers[stage]) {
        const url = await uploadImageBufferToCloudinary(
          imageBuffers[stage].buffer,
          imageBuffers[stage].fileName,
          `${slug}/${slug}_${stage}`,
        );
        lifecycleImages[`${slug}_${stage}`] = url;
      }
    }

    console.log("Updating database...");

    // Update MongoDB with all the URLs and metadata
    const result = await plantCollection.updateOne(
      { slug },
      {
        $set: {
          name: plantName,
          slug,
          waterFreq: waterFreq || null,
          difficulty: difficulty || "Unknown",
          heroImage: heroUrl,
          images: lifecycleImages,
          description,
        },
      },
      { upsert: true },
    );

    if (result.upsertedId) {
      console.log(`✅ Plant added: ${plantName} (${slug})`);
    } else if (result.modifiedCount > 0) {
      console.log(`✅ Plant updated: ${plantName} (${slug})`);
    }

    reportProgress(onProgress, 8, `Saved generated assets for ${plantName}.`);

    return {
      slug,
      heroImage: heroUrl,
      images: lifecycleImages,
      description,
    };
  } catch (err) {
    console.error(`❌ Error uploading assets to database: ${err.message}`);
    throw err;
  }
}

async function generatePlantAssets(
  slug,
  plantName,
  waterFreq,
  difficulty,
  plantCollection,
  options = {},
) {
  const onProgress = options.onProgress;

  if (!API_KEY) {
    throw new Error(
      "Missing GEMINI_API_KEY. Add it to your environment or .env file.",
    );
  }

  if (!UNSPLASH_ACCESS_KEY) {
    throw new Error(
      "Missing UNSPLASH_ACCESS_KEY. Add it to your environment or .env file.",
    );
  }

  console.log(`\n🌱 Generating assets for: ${plantName}`);
  console.log(`   Slug: ${slug}`);
  console.log(`   Water frequency: ${waterFreq} days`);
  console.log(`   Difficulty: ${difficulty}`);

  try {
    console.log("\n📝 Generating description...");
    const description = await generateDescription(plantName, onProgress);

    console.log("\n📸 Generating images...");
    const imageBuffers = await generateImageBuffers(
      plantName,
      slug,
      onProgress,
    );

    console.log("\n☁️  Uploading to Cloudinary and MongoDB...");
    const result = await uploadAssetsToDatabase(
      slug,
      plantName,
      imageBuffers,
      description,
      waterFreq,
      difficulty,
      plantCollection,
      onProgress,
    );

    console.log("\n✅ Plant assets generated and stored successfully!\n");
    return result;
  } catch (error) {
    console.error(`\n❌ Error generating plant assets: ${error.message}`);
    throw error;
  }
}

module.exports = { generatePlantAssets };
