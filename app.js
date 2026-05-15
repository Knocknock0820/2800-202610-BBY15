// Setting up server, routes, and connecting to MongoDB all hand written.
// Unless mentioned otherwise in the comments.
// Modified by: Harun Yaprak

require("dotenv").config();

const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const bcrypt = require("bcrypt");
const Joi = require("joi");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
//const upload = require("./middleware/upload"); //shivika added hehe
const { ObjectId } = require("mongodb");

const fs = require("fs"); // Built-in Node.js File System module
const path = require("path"); // Built-in Path module
const { marked } = require("marked");

const weatherApiRouter = require("./routes/weatherApi");
const { seedPlants, loadPlantsWithFiles } = require("./public/js/seedPlants");

const app = express();
const port = 3000;
const saltRounds = 12;
const expireTime = 60 * 60 * 1000;

const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_user_database = process.env.MONGODB_USER_DATABASE;
const mongodb_session_database = process.env.MONGODB_SESSION_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;

const { database } = require("./config/MongoDB");
const e = require("express");
const userCollection = database
  .db(mongodb_user_database)
  .collection("user-info");

const plantCollection = database
  .db(mongodb_user_database)
  .collection("plant-types");

const postCollection = database
  .db(mongodb_user_database)
  .collection("community-posts");

const userPlantCollection = database
  .db(mongodb_user_database)
  .collection("user-plants");

// Load plant files and seed on startup
(async () => {
  try {
    const existingPlants = await plantCollection.countDocuments();

    if (existingPlants === 0) {
      // Fresh database — seed everything
      await loadPlantsWithFiles();
      await seedPlants(plantCollection);
    } else {
      // Check if existing plants have the new 'slug' field
      const hasSlug = await plantCollection.findOne({
        slug: { $exists: true },
      });
      if (!hasSlug) {
        // Old format plants without slugs — drop and re-seed
        console.log("Old plant format detected (no slugs). Re-seeding...");
        await plantCollection.deleteMany({});
        await loadPlantsWithFiles();
        await seedPlants(plantCollection);
      } else {
        // Also upsert to pick up any new species added to seedPlants
        await loadPlantsWithFiles();
        await seedPlants(plantCollection);
        console.log("Plant types synced.");
      }
    }
  } catch (err) {
    console.error("Error loading and seeding plants:", err);
  }
})();

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/api/weather", weatherApiRouter);

var mongoStore = MongoStore.create({
  mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_session_database}`,
  crypto: { secret: mongodb_session_secret },
});

// Adapted from Cloudinary Upload Tutorial: https://www.youtube.com/watch?v=2Z1oKtxleb4
// Modified by: Harun Yaprak
// ======================================
// Set up Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "community_uploads", // Cloudinary'de açılacak klasör adı
    allowed_formats: ["jpg", "jpeg", "png", "webp", "heic"], // heic iPhone fotoğrafları için önemlidir
  },
});

// Separate storage config for plant images
const plantImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "plant_images",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "heic"],
  },
});

const upload = multer({ storage: storage });
const plantImageUpload = multer({ storage: plantImageStorage });

function requiredLogin(req, res, next) {
  if (!req.session.authenticated) {
    res.redirect("/landing");
  } else {
    next();
  }
}

// ======================================

// Set up session store
app.use(
  session({
    secret: node_session_secret,
    store: mongoStore,
    saveUninitialized: false,
    resave: true,
  }),
);

// Render the main page
app.get("/", requiredLogin, (req, res) => {
  res.render("mainpage.ejs", {
    name: req.session.username,
    firstLogin: req.query.firstLogin === "true",
  });
});

// API endpoint to fetch plant types
//Modified by: Harun Yaprak
app.get("/api/plants", requiredLogin, async (req, res) => {
  try {
    const plants = await plantCollection
      .find({})
      .project({ _id: 1, name: 1, waterFreq: 1, slug: 1, temp: 1, mistingFreq: 1, harvestDays: 1 })
      .toArray();
    res.json(plants);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch plants" });
  }
});

// API endpoint to fetch hero image for a plant
//Modified by: Harun Yaprak
app.get("/api/plants/:slug/hero-image", requiredLogin, async (req, res) => {
  const slug = req.params.slug;

  try {
    const plant = await plantCollection.findOne({ slug });

    if (!plant || !plant.heroImage) {
      return res.status(404).json({ error: "Image not found" });
    }

    if (
      typeof plant.heroImage === "string" &&
      plant.heroImage.startsWith("http")
    ) {
      return res.redirect(plant.heroImage);
    }

    // Backward compatibility for older base64 records
    const buffer = Buffer.from(plant.heroImage, "base64");
    res.set("Content-Type", "image/jpeg");
    res.send(buffer);
  } catch (err) {
    console.error("Error fetching hero image:", err);
    res.status(500).json({ error: "Failed to fetch image" });
  }
});

// API endpoint to fetch lifecycle images for a plant
//Modified by: Harun Yaprak
app.get(
  "/api/plants/:slug/lifecycle-image/:imageName",
  requiredLogin,
  async (req, res) => {
    const slug = req.params.slug;
    const imageName = req.params.imageName;

    try {
      const plant = await plantCollection.findOne({ slug });

      if (!plant || !plant.images || !plant.images[imageName]) {
        return res.status(404).json({ error: "Image not found" });
      }

      const imageValue = plant.images[imageName];

      if (typeof imageValue === "string" && imageValue.startsWith("http")) {
        return res.redirect(imageValue);
      }

      // Backward compatibility for older base64 records
      const buffer = Buffer.from(imageValue, "base64");
      res.set("Content-Type", "image/jpeg");
      res.send(buffer);
    } catch (err) {
      console.error("Error fetching lifecycle image:", err);
      res.status(500).json({ error: "Failed to fetch image" });
    }
  },
);

// Render the about page
//Modified by: Harun Yaprak
app.get("/about", (req, res) => {
  res.render("about.ejs");
});

// Render the landing page
//Modified by: Harun Yaprak
app.get("/landing", (req, res) => {
  res.render("landing.ejs");
});

// Render the login page
//Modified by: Harun Yaprak
app.get("/login", (req, res) => {
  res.render("login.ejs", { error: null });
});

// Handle login form submission
//Modified by: Harun Yaprak
app.post("/login", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  const schema = Joi.string().email().required();
  if (schema.validate(email).error) {
    res.redirect("/login", { error: "Please enter a valid email." });
    return;
  }

  const result = await userCollection.findOne(
    { email },
    { projection: { _id: 0, email: 1, password: 1, username: 1 } },
  );

  if (!result) {
    res.render("login.ejs", { error: "Email not found." });
    return;
  }

  if (await bcrypt.compare(password, result.password)) {
    req.session.authenticated = true;
    req.session.email = result.email;
    req.session.username = result.username;
    req.session.cookie.maxAge = expireTime;
    res.redirect("/");
  } else {
    res.render("login.ejs", { error: "Invalid password." });
  }
});

// Render the signup page
//Modified by: Harun Yaprak
app.get("/signup", (req, res) => {
  res.render("signup.ejs");
});

// Handle signup form submission
//Modified by: Harun Yaprak
app.post("/signup", async (req, res) => {
  const username = req.body.username;
  const email = req.body.email;
  const password = req.body.password;

  const schema = Joi.object({
    username: Joi.string().alphanum().min(2).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(3).max(30).required(),
  });

  if (schema.validate({ username, email, password }).error) {
    res.redirect("/signup");
    return;
  }

  const hashedPassword = await bcrypt.hash(password, saltRounds);
  await userCollection.insertOne({ username, email, password: hashedPassword });

  req.session.authenticated = true;
  req.session.email = email;
  req.session.username = username;
  req.session.cookie.maxAge = expireTime;
  res.redirect("/?firstLogin=true");
});

// Render the profile page
//added more to it shivika for profile page

app.get("/profile", requiredLogin, async (req, res) => {
  try {
    const user = await userCollection.findOne({ email: req.session.email });
    res.render("profile.ejs", {
      user,
      name: req.session.username,
      error: null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// should hangle allowing user to change password option is avaiable in the profile
// got help from youtube: https://youtu.be/AzA_LTDoFqY
//by shivika
app.post("/change-password", requiredLogin, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    const user = await userCollection.findOne({ email: req.session.email });
    return res.render("profile.ejs", { user, name: req.session.username, error: "New passwords do not match." });
  }

  const user = await userCollection.findOne({ email: req.session.email });
  const valid = await bcrypt.compare(currentPassword, user.password);

  if (!valid) {
    return res.render("profile.ejs", { user, name: req.session.username, error: "Current password is incorrect." });
  }

  const hashed = await bcrypt.hash(newPassword, saltRounds);
  await userCollection.updateOne({ email: req.session.email }, { $set: { password: hashed } });

  res.redirect("/profile");
});

//   Render the community page — fetch 5 random posts from MongoDB
app.get("/community", requiredLogin, async (req, res) => {
  try {
    const posts = await postCollection
      .aggregate([{ $sample: { size: 5 } }])
      .toArray();
    res.render("community.ejs", { name: req.session.username, posts: posts });
  } catch (err) {
    console.error("Error fetching community posts:", err);
    res.render("community.ejs", { name: req.session.username, posts: [] });
  }
});

// Handle profile
//if everyhting wokring well should be able to save photo to mongo
app.post(
  "/profile",
  requiredLogin,
  upload.single("photo"),
  async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        dateOfBirth,
        occupation,
        salary,
        whyGardening,
      } = req.body;

      const updates = {
        firstName,
        lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        occupation,
        salary: salary ? Number(salary) : null,
        whyGardening,
      };

      // Save Cloudinary image URL
      if (req.file) {
        updates.photoUrl = req.file.path;
        updates.photoPublicId = req.file.filename;
      }

      await userCollection.updateOne(
        { email: req.session.email }, // find the logged-in user
        { $set: updates }, // update only the profile fields, leave email/password untouched
      );

      res.redirect("/profile");
    } catch (err) {
      console.error(err);
      res.render("profile.ejs", {
        user: null,
        name: req.session.username,
        error: err.message,
      });
    }
  },
);

app.post(
  "/community/upload",
  requiredLogin,
  upload.single("image"),
  async (req, res) => {
    try {
      const imageUrl = req.file.path;

      const caption = req.body.caption;

      const newPost = {
        username: req.session.username,
        imageUrl: imageUrl,
        caption: caption,
        createdAt: new Date(),
      };

      await postCollection.insertOne(newPost);

      res.redirect("/community");
    } catch (err) {
      console.error("Error uploading post", err);
      res.status(500).send("Error uploading post");
    }
  },
);

// Adopted code from AI
// Modified by: Harun Yaprak
// Toggle like on a community post
app.post("/community/like/:id", requiredLogin, async (req, res) => {
  try {
    const postId = req.params.id;
    const username = req.session.username;

    // Find the post
    const post = await postCollection.findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Check if the user already liked it
    const likes = post.likes || [];
    const hasLiked = likes.includes(username);

    let updateQuery;
    if (hasLiked) {
      // User liked it already, so unlike it (pull username)
      updateQuery = { $pull: { likes: username } };
    } else {
      // User hasn't liked it, so like it (addToSet username)
      updateQuery = { $addToSet: { likes: username } };
    }

    // Perform the update
    await postCollection.updateOne({ _id: new ObjectId(postId) }, updateQuery);

    // Calculate new like count
    const newCount = hasLiked ? likes.length - 1 : likes.length + 1;

    res.json({
      likedByUser: !hasLiked,
      likesCount: newCount,
    });
  } catch (err) {
    console.error("Error toggling like:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Upload plant image to Cloudinary
// Modified by: Harun Yaprak
app.post(
  "/api/plants/upload-image",
  requiredLogin,
  plantImageUpload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }
      const imageUrl = req.file.path;
      res.json({ imageUrl: imageUrl });
    } catch (err) {
      console.error("Error uploading plant image:", err);
      res.status(500).json({ error: "Failed to upload image" });
    }
  },
);

// Render the details page
//Modified by: Steven Chi
app.get("/details/:slug", requiredLogin, async (req, res) => {
  const slug = req.params.slug;

  function toDataUrl(base64String) {
    if (!base64String) {
      return null;
    }

    if (typeof base64String === "string" && base64String.startsWith("http")) {
      return base64String;
    }

    return `data:image/jpeg;base64,${base64String}`;
  }

  try {
    // Fetch plant details from database
    const plant = await plantCollection.findOne({ slug });

    if (!plant) {
      return res.status(404).render("404");
    }

    // Convert markdown description to HTML
    let descriptionHtml = "";
    if (plant.description) {
      descriptionHtml = marked.parse(plant.description);
    }

    res.render("details.ejs", {
      plant: plant,
      species: plant.name,
      slug: slug,
      difficulty: plant.difficulty || "Unknown",
      heroImage: toDataUrl(plant.heroImage),
      lifecycleImages: plant.images
        ? Object.fromEntries(
            Object.entries(plant.images).map(([key, value]) => [
              key,
              toDataUrl(value),
            ]),
          )
        : {},
      descriptionHtml: descriptionHtml,
      // New fields for template display
      waterFreq: typeof plant.waterFreq === "number" ? plant.waterFreq : null,
      temp: typeof plant.temp === "number" ? plant.temp : null,
    });
  } catch (err) {
    console.error("Error fetching plant details:", err);
    res.status(500).render("404");
  }
});

// store users plants in the database
// BY Justin with AI help.
app.post("/api/user/plants", requiredLogin, async (req, res) => {
  try {
    const plant = req.body;

    const newPlant = {
      id: plant.id, // IMPORTANT: keep frontend ID
      userEmail: req.session.email,
      username: req.session.username,

      species: plant.species,
      slug: plant.slug,
      nickname: plant.nickname || "",
      waterFreq: plant.waterFreq,
      intervalDays: plant.intervalDays,

      imageUrl: plant.imageUrl || null,
      lastWateredAt: plant.lastWateredAt || null,
      movedToShadeAt: null,
      lastMistedAt: plant.lastMistedAt || null,
      lastRotatedAt: plant.lastRotatedAt || null,
      lastHarvestedAt: plant.lastHarvestedAt || null,

      addedAt: plant.addedAt || new Date().toISOString(),
    };

    await userPlantCollection.insertOne(newPlant);

    res.json({ success: true, plant: newPlant });
  } catch (err) {
    console.error("Save plant error:", err);
    res.status(500).json({ error: "Failed to save plant" });
  }
});

// Update a user plant record
app.put("/api/user/plants/:id", requiredLogin, async (req, res) => {
  try {
    const plantId = Number(req.params.id);
    const updates = {};

    if (req.body.lastWateredAt !== undefined) {
      updates.lastWateredAt = req.body.lastWateredAt;
    }
    if (req.body.movedToShadeAt !== undefined) {
      updates.movedToShadeAt = req.body.movedToShadeAt;
    }
    if (req.body.nickname !== undefined) {
      updates.nickname = req.body.nickname;
    }
    if (req.body.intervalDays !== undefined) {
      updates.intervalDays = req.body.intervalDays;
    }
    if (req.body.waterFreq !== undefined) {
      updates.waterFreq = req.body.waterFreq;
    }
    if (req.body.imageUrl !== undefined) {
      updates.imageUrl = req.body.imageUrl;
    }
    if (req.body.lastMistedAt !== undefined) {
      updates.lastMistedAt = req.body.lastMistedAt;
    }
    if (req.body.lastRotatedAt !== undefined) {
      updates.lastRotatedAt = req.body.lastRotatedAt;
    }
    if (req.body.lastHarvestedAt !== undefined) {
      updates.lastHarvestedAt = req.body.lastHarvestedAt;
    }

    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ error: "No valid fields provided for update" });
    }

    await userPlantCollection.updateOne(
      { id: plantId, userEmail: req.session.email },
      { $set: updates },
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Update plant error:", err);
    res.status(500).json({ error: "Failed to update plant" });
  }
});

//fetch the users plants stored in the databse
//by Justin with AI help
app.get("/api/user/plants", requiredLogin, async (req, res) => {
  try {
    const plants = await userPlantCollection
      .find({ userEmail: req.session.email })
      .toArray();

    res.json(plants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load plants" });
  }
});

//delete user plants from database.
app.delete("/api/user/plants/:id", requiredLogin, async (req, res) => {
  try {
    const plantId = Number(req.params.id);

    await userPlantCollection.deleteOne({
      id: plantId,
      userEmail: req.session.email,
    });

    res.json({
      success: true,
    });
  } catch (err) {
    console.error("Delete error:", err);

    res.status(500).json({
      error: "Failed to delete plant",
    });
  }
});

//watering save in database.
//Justin with AI help.
app.patch("/api/user/plants/:id/water", requiredLogin, async (req, res) => {
  try {
    const plantId = Number(req.params.id);

    await userPlantCollection.updateOne(
      {
        id: plantId,
        userEmail: req.session.email,
      },
      {
        $set: {
          lastWateredAt: req.body.lastWateredAt,
        },
      },
    );

    res.json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed to update plant",
    });
  }
});

//handle shade to database
//justin with Ai
app.patch("/api/user/plants/:id/shade", requiredLogin, async (req, res) => {
  try {
    const plantId = Number(req.params.id);

    await userPlantCollection.updateOne(
      {
        id: plantId,
        userEmail: req.session.email,
      },
      {
        $set: {
          movedToShadeAt: req.body.movedToShadeAt,
        },
      },
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update shade state" });
  }
});

//store images into database
//justin with AI
app.patch("/api/user/plants/:id/image", requiredLogin, async (req, res) => {
  try {
    const plantId = Number(req.params.id);

    await userPlantCollection.updateOne(
      {
        id: plantId,
        userEmail: req.session.email,
      },
      {
        $set: {
          imageUrl: req.body.imageUrl,
        },
      },
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Image update error:", err);
    res.status(500).json({ error: "Failed to update image" });
  }
});

// Handle logout
app.post("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/landing");
});

// Handle non-existent routes
app.use((req, res) => {
  res.status(404);
  res.render("404");
});

// Start the server
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});