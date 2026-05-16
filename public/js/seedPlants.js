require("dotenv").config();

const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;

const mongodb_user_database = process.env.MONGODB_USER_DATABASE;

const { database } = require("../../config/MongoDB");

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
    console.error(`Error reading markdown file ${filePath}:`, err);
    return null;
  }
}

const defaultPlants = [
  {
    name: "Monstera",
    slug: "monstera",
    waterFreq: 7, // days between watering
    temp: 28, // comfortable max temp in °C
    mistingFreq: 3, // days between misting
    harvestDays: 120, // days until harvest
    difficulty: "Easy",
    heroImage: null,
    images: {
      monstera_seed: null,
      monstera_sprout: null,
      monstera_mature: null,
      monstera_flower: null,
      monstera_harvest: null,
    },
    description: null,
  },
  { name: "Snake Plant", slug: "snake_plant", waterFreq: 30, temp: 35 },
  { name: "Cactus", slug: "cactus", waterFreq: 14, temp: 40 },
  { name: "Peace Lily", slug: "peace_lily", waterFreq: 3, temp: 30, mistingFreq: 2 },
  { name: "Spider Plant", slug: "spider_plant", waterFreq: 7, temp: 32, mistingFreq: 4 },
  { name: "Pothos", slug: "pothos", waterFreq: 10, temp: 32, mistingFreq: 4 },
  { name: "Aloe Vera", slug: "aloe_vera", waterFreq: 21, temp: 35, harvestDays: 60 },
  { name: "Rubber Tree", slug: "rubber_tree", waterFreq: 14, temp: 32, mistingFreq: 7 },
];

// Load plant data from files
async function loadPlantsWithFiles() {
  const monsteraBasePath = path.join(
    __dirname,
    "..",
    "images",
    "details",
    "monstera",
  );
  const descriptionsPath = path.join(__dirname, "..", "descriptions");

  // Load Monstera hero image
  defaultPlants[0].heroImage = await uploadFileToCloudinary(
    path.join(monsteraBasePath, "monstera.jpg"),
    "monstera/monstera",
  );

  // Load Monstera lifecycle images
  defaultPlants[0].images.monstera_seed = await uploadFileToCloudinary(
    path.join(monsteraBasePath, "monstera_seed.jpg"),
    "monstera/monstera_seed",
  );
  defaultPlants[0].images.monstera_sprout = await uploadFileToCloudinary(
    path.join(monsteraBasePath, "monstera_sprout.jpg"),
    "monstera/monstera_sprout",
  );
  defaultPlants[0].images.monstera_mature = await uploadFileToCloudinary(
    path.join(monsteraBasePath, "monstera_mature.jpg"),
    "monstera/monstera_mature",
  );
  defaultPlants[0].images.monstera_flower = await uploadFileToCloudinary(
    path.join(monsteraBasePath, "monstera_flower.jpg"),
    "monstera/monstera_flower",
  );
  defaultPlants[0].images.monstera_harvest = await uploadFileToCloudinary(
    path.join(monsteraBasePath, "monstera_harvest.jpg"),
    "monstera/monstera_harvest",
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
