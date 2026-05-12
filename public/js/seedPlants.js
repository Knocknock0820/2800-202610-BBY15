require("dotenv").config();

const mongodb_user_database = process.env.MONGODB_USER_DATABASE;

const { database } = require("../../config/MongoDB");

const defaultPlants = [
  { name: "Monstera", waterFreq: "Every week" },
  { name: "Snake Plant", waterFreq: "Once a month" },
  { name: "Cactus", waterFreq: "Every 2 weeks" },
  { name: "Peace Lily", waterFreq: "Every 3 days" },
  { name: "Spider Plant", waterFreq: "Every week" },
  { name: "Pothos", waterFreq: "Every 1-2 weeks" },
  { name: "Aloe Vera", waterFreq: "Every 2-3 weeks" },
  { name: "Rubber Tree", waterFreq: "Every 2 weeks" },
];

async function seedPlants(plantCollection, plants = defaultPlants) {
  try {
    const operations = plants.map((plant) => ({
      updateOne: {
        filter: { name: plant.name },
        update: { $setOnInsert: plant },
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

module.exports = { seedPlants, defaultPlants };

if (require.main === module) {
  (async () => {
    try {
      await database.connect();
      const plantCollection = database
        .db(mongodb_user_database)
        .collection("plant-types");

      await seedPlants(plantCollection);
    } catch (err) {
      console.error("Error running plant seed script:", err);
      process.exitCode = 1;
    } finally {
      await database.close();
    }
  })();
}
