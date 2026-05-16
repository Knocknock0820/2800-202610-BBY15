#!/usr/bin/env node

/**
 * Bulk Add Plants to Database
 *
 * Usage: node scripts/bulkAddPlants.js <filePath>
 *
 * Example: node scripts/bulkAddPlants.js scripts/plant-list.txt
 *
 * This script reads a file with plant species names (one per line),
 * converts each name to a slug, creates a database entry with name and slug
 * (other attributes left empty), and creates the folder structure under
 * public/images/details/<slug>/.
 *
 * Input file format: One plant name per line
 * Example:
 *   Monstera
 *   Snake Plant
 *   Peace Lily
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");

const mongodb_user_database = process.env.MONGODB_USER_DATABASE;

const { database } = require("../config/MongoDB");

/**
 * Convert plant name to slug
 * Example: "Snake Plant" -> "snake_plant"
 */
function nameToSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .replace(/[^\w_]/g, "") // Remove special characters
    .replace(/_+/g, "_"); // Collapse multiple underscores
}

/**
 * Read plant names from a file (one per line)
 */
function readPlantNamesFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0); // Remove empty lines
  } catch (err) {
    console.error(`❌ Error reading file ${filePath}:`, err.message);
    return null;
  }
}

/**
 * Create a folder for a plant slug if it doesn't exist
 */
function createPlantImageFolder(slug) {
  const folderPath = path.join(
    __dirname,
    "..",
    "public",
    "images",
    "details",
    slug,
  );

  try {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      console.log(`📁 Created folder: public/images/details/${slug}`);
      return true;
    } else {
      console.log(`ℹ️  Folder already exists: public/images/details/${slug}`);
      return false;
    }
  } catch (err) {
    console.error(`❌ Error creating folder ${folderPath}:`, err.message);
    return false;
  }
}

/**
 * Create a plant object with name and slug, other attributes empty
 */
function createPlantObject(name, slug) {
  return {
    name,
    slug,
    waterFreq: null,
    temp: null,
    mistingFreq: null,
    harvestDays: null,
    difficulty: null,
    heroImage: null,
    images: {
      [`${slug}_seed`]: null,
      [`${slug}_sprout`]: null,
      [`${slug}_mature`]: null,
      [`${slug}_flower`]: null,
      [`${slug}_harvest`]: null,
    },
    description: null,
  };
}

/**
 * Add a single plant to the database
 */
async function addPlantToDatabase(plantCollection, plant) {
  try {
    const result = await plantCollection.updateOne(
      { slug: plant.slug },
      { $set: plant },
      { upsert: true },
    );

    if (result.upsertedId) {
      console.log(`✅ Added: ${plant.name} (${plant.slug})`);
      return true;
    } else if (result.modifiedCount > 0) {
      console.log(`✅ Updated: ${plant.name} (${plant.slug})`);
      return true;
    } else {
      console.log(`ℹ️  No changes: ${plant.name} (${plant.slug})`);
      return false;
    }
  } catch (err) {
    console.error(`❌ Error adding plant: ${err.message}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error("Usage: node scripts/bulkAddPlants.js <filePath>");
    console.error(
      "Example: node scripts/bulkAddPlants.js scripts/plant-list.txt",
    );
    console.error("\nInput file format: One plant name per line");
    console.error("Example file contents:");
    console.error("  Monstera");
    console.error("  Snake Plant");
    console.error("  Peace Lily");
    process.exitCode = 1;
    return;
  }

  const filePath = args[0];

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exitCode = 1;
    return;
  }

  console.log(`📖 Reading plant names from: ${filePath}`);

  const plantNames = readPlantNamesFromFile(filePath);

  if (!plantNames || plantNames.length === 0) {
    console.error("❌ No plant names found in file or file is empty");
    process.exitCode = 1;
    return;
  }

  console.log(`\n📋 Found ${plantNames.length} plant(s)\n`);

  try {
    await database.connect();
    const plantCollection = database
      .db(mongodb_user_database)
      .collection("plant-types");

    let addedCount = 0;
    let failedCount = 0;

    // Process each plant
    for (const plantName of plantNames) {
      const slug = nameToSlug(plantName);

      // Create folder
      createPlantImageFolder(slug);

      // Create plant object
      const plant = createPlantObject(plantName, slug);

      // Add to database
      const success = await addPlantToDatabase(plantCollection, plant);
      if (success) {
        addedCount++;
      } else {
        failedCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Total plants: ${plantNames.length}`);
    console.log(`   Successfully added/updated: ${addedCount}`);
    if (failedCount > 0) {
      console.log(`   Failed: ${failedCount}`);
    }

    process.exitCode = failedCount > 0 ? 1 : 0;
  } catch (err) {
    console.error("❌ Error running bulk add plants script:", err);
    process.exitCode = 1;
  } finally {
    await database.close();
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}

module.exports = { nameToSlug, createPlantObject };
