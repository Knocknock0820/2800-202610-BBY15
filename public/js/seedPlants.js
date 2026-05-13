require("dotenv").config();

const fs = require("fs");
const path = require("path");

const mongodb_user_database = process.env.MONGODB_USER_DATABASE;

const { database } = require("../../config/MongoDB");

// Helper function to read a file and encode as base64
function readFileAsBase64(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    return data.toString("base64");
  } catch (err) {
    console.error(`Error reading file ${filePath}:`, err);
    return null;
  }
}

// Helper function to read markdown file
function readMarkdownFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    console.error(`Error reading markdown file ${filePath}:`, err);
    return null;
  }
}

const defaultPlants = [
  {
    name: "Monstera",
    slug: "monstera",
    waterFreq: "Every week",
    difficulty: "Easy",
    heroImage: null, // Will be populated with base64 data
    images: {
      monstera_seed: null,
      monstera_sprout: null,
      monstera_mature: null,
      monstera_flower: null,
      monstera_harvest: null,
    },
    description: null, // Will be populated with markdown file content
  },
  { name: "Snake Plant", slug: "snake_plant", waterFreq: "Once a month" },
  { name: "Cactus", slug: "cactus", waterFreq: "Every 2 weeks" },
  { name: "Peace Lily", slug: "peace_lily", waterFreq: "Every 3 days" },
  { name: "Spider Plant", slug: "spider_plant", waterFreq: "Every week" },
  { name: "Pothos", slug: "pothos", waterFreq: "Every 1-2 weeks" },
  { name: "Aloe Vera", slug: "aloe_vera", waterFreq: "Every 2-3 weeks" },
  { name: "Rubber Tree", slug: "rubber_tree", waterFreq: "Every 2 weeks" },
];

// Load plant data from files
async function loadPlantsWithFiles() {
  const monsteraBasePath = path.join(__dirname, "..", "images");
  const descriptionsPath = path.join(__dirname, "..", "descriptions");

  // Load Monstera hero image
  defaultPlants[0].heroImage = readFileAsBase64(
    path.join(monsteraBasePath, "monstera.jpg"),
  );

  // Load Monstera lifecycle images
  defaultPlants[0].images.monstera_seed = readFileAsBase64(
    path.join(monsteraBasePath, "monstera_seed.jpg"),
  );
  defaultPlants[0].images.monstera_sprout = readFileAsBase64(
    path.join(monsteraBasePath, "monstera_sprout.jpg"),
  );
  defaultPlants[0].images.monstera_mature = readFileAsBase64(
    path.join(monsteraBasePath, "monstera_mature.jpg"),
  );
  defaultPlants[0].images.monstera_flower = readFileAsBase64(
    path.join(monsteraBasePath, "monstera_flower.jpg"),
  );
  defaultPlants[0].images.monstera_harvest = readFileAsBase64(
    path.join(monsteraBasePath, "monstera_harvest.jpg"),
  );

  // Load Monstera description markdown
  defaultPlants[0].description = readMarkdownFile(
    path.join(descriptionsPath, "monstera.md"),
  );

  return defaultPlants;
}

async function seedPlants(plantCollection, plants = defaultPlants) {
  try {
    const operations = plants.map((plant) => ({
      updateOne: {
        filter: { name: plant.name },
        update: { $set: plant },
        upsert: true,
      },
    }));

    if (operations.length === 0) {
      return;
    }

    const result = await plantCollection.bulkWrite(operations, {
      ordered: false,
    });

    if (result.upsertedCount > 0) {
      console.log(
        `Seeded ${result.upsertedCount} plant type(s) into database.`,
      );
    }
  } catch (err) {
    console.error("Error seeding plants:", err);
  }
}

module.exports = { seedPlants, defaultPlants, loadPlantsWithFiles };

if (require.main === module) {
  (async () => {
    try {
      await database.connect();
      const plantCollection = database
        .db(mongodb_user_database)
        .collection("plant-types");

      // Load plant data from files before seeding
      await loadPlantsWithFiles();
      await seedPlants(plantCollection);
    } catch (err) {
      console.error("Error running plant seed script:", err);
      process.exitCode = 1;
    } finally {
      await database.close();
    }
  })();
}
