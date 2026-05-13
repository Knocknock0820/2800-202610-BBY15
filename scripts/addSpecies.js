#!/usr/bin/env node

/**
 * Add Species to Database
 *
 * Usage: node scripts/addSpecies.js <name> <slug> <waterFreq> [difficulty]
 *
 * Example: node scripts/addSpecies.js "Snake Plant" snake_plant "Once a month" "Easy"
 *
 * This script automatically discovers files from public/images/ and public/descriptions/
 * following the naming convention:
 * - Hero image: {slug}.jpg (or .png)
 * - Lifecycle images: {slug}_{stage}.jpg where stage = seed, sprout, mature, flower, harvest
 * - Description: {slug}.md
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;

const mongodb_user_database = process.env.MONGODB_USER_DATABASE;

const { database } = require("../config/MongoDB");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper function to upload a local image file to Cloudinary
async function uploadFileToCloudinary(filePath, publicId) {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "plant-types",
      public_id: publicId,
      overwrite: true,
      resource_type: "image",
    });

    return result.secure_url;
  } catch (err) {
    console.error(`Error uploading file ${filePath}:`, err.message || err);
    return null;
  }
}

// Helper function to read markdown file
function readMarkdownFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    return null;
  }
}

// Helper function to check if a file exists
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

// Discover all lifecycle images for a plant based on slug
async function discoverLifecycleImages(imagesPath, slug) {
  const stages = ["seed", "sprout", "mature", "flower", "harvest"];
  const images = {};

  for (const stage of stages) {
    const imageName = `${slug}_${stage}`;
    let imagePath = path.join(imagesPath, `${imageName}.jpg`);

    if (!fileExists(imagePath)) {
      imagePath = path.join(imagesPath, `${imageName}.png`);
    }

    if (fileExists(imagePath)) {
      images[imageName] = await uploadFileToCloudinary(
        imagePath,
        `${slug}/${imageName}`,
      );
    } else {
      console.warn(`⚠️  Missing lifecycle image: ${imageName}.jpg/png`);
    }
  }

  return images;
}

// Discover hero image for a plant based on slug
async function discoverHeroImage(imagesPath, slug) {
  let heroPath = path.join(imagesPath, `${slug}.jpg`);

  if (!fileExists(heroPath)) {
    heroPath = path.join(imagesPath, `${slug}.png`);
  }

  if (fileExists(heroPath)) {
    return uploadFileToCloudinary(heroPath, `${slug}/${slug}`);
  }

  console.warn(`⚠️  Missing hero image: ${slug}.jpg/png`);
  return null;
}

// Discover description markdown for a plant based on slug
function discoverDescription(descriptionsPath, slug) {
  const descPath = path.join(descriptionsPath, `${slug}.md`);

  if (fileExists(descPath)) {
    return readMarkdownFile(descPath);
  }

  console.warn(`⚠️  Missing description: ${slug}.md`);
  return null;
}

// Create plant object from discovered files
async function createPlantFromFiles(name, slug, waterFreq, difficulty) {
  const imagesPath = path.join(__dirname, "..", "public", "images");
  const descriptionsPath = path.join(__dirname, "..", "public", "descriptions");

  const plant = {
    name,
    slug,
    waterFreq,
    difficulty: difficulty || "Unknown",
    heroImage: await discoverHeroImage(imagesPath, slug),
    images: await discoverLifecycleImages(imagesPath, slug),
    description: discoverDescription(descriptionsPath, slug),
  };

  return plant;
}

// Add a single species to the database
async function addSpecies(plantCollection, plant) {
  try {
    const result = await plantCollection.updateOne(
      { slug: plant.slug },
      { $set: plant },
      { upsert: true },
    );

    if (result.upsertedId) {
      console.log(`✅ Species added: ${plant.name} (${plant.slug})`);
      return true;
    } else if (result.modifiedCount > 0) {
      console.log(`✅ Species updated: ${plant.name} (${plant.slug})`);
      return true;
    } else {
      console.log(`ℹ️  No changes: ${plant.name} (${plant.slug})`);
      return false;
    }
  } catch (err) {
    console.error(`❌ Error adding species: ${err.message}`);
    return false;
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error(
      "Usage: node scripts/addSpecies.js <name> <slug> <waterFreq> [difficulty]",
    );
    console.error(
      'Example: node scripts/addSpecies.js "Snake Plant" snake_plant "Once a month" "Easy"',
    );
    process.exitCode = 1;
    return;
  }

  const [name, slug, waterFreq, difficulty] = args;

  console.log(`📦 Adding species: ${name}`);
  console.log(`   Slug: ${slug}`);
  console.log(`   Water frequency: ${waterFreq}`);
  console.log(`   Difficulty: ${difficulty || "Unknown"}`);

  try {
    await database.connect();
    const plantCollection = database
      .db(mongodb_user_database)
      .collection("plant-types");

    const plant = await createPlantFromFiles(name, slug, waterFreq, difficulty);

    // Validate that at least the hero image exists
    if (!plant.heroImage) {
      console.error(`❌ Hero image is required but not found. Aborting.`);
      process.exitCode = 1;
      return;
    }

    const success = await addSpecies(plantCollection, plant);
    process.exitCode = success ? 0 : 1;
  } catch (err) {
    console.error("❌ Error running species script:", err);
    process.exitCode = 1;
  } finally {
    await database.close();
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}

module.exports = { createPlantFromFiles, addSpecies };
