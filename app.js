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

const fs = require("fs"); // Built-in Node.js File System module
const path = require("path"); // Built-in Path module
const { marked } = require("marked");

const weatherApiRouter = require("./routes/weatherApi");

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

/* Seed example plants types to database on startup (if database is empty)
  This function will be changed in the future,
   after we figured out how to implement the database  */

// This code is handwritten, but got help from AI.
//Modified by: Harun Yaprak
async function seedPlants() {
  try {
    const count = await plantCollection.countDocuments();
    if (count === 0) {
      const defaultPlants = [
        { name: "Monstera", waterFreq: "Every week" },
        { name: "Snake Plant", waterFreq: "Once a month" },
        { name: "Cactus", waterFreq: "Every 2 weeks" },
        { name: "Peace Lily", waterFreq: "Every 3 days" },
        { name: "Spider Plant", waterFreq: "Every week" },
        { name: "Pothos", waterFreq: "Every 1-2 weeks" },
        { name: "Aloe Vera", waterFreq: "Every 2-3 weeks" },
      ];
      await plantCollection.insertMany(defaultPlants);
      console.log("Seeded default plant types into database.");
    }
  } catch (err) {
    console.error("Error seeding plants:", err);
  }
}
seedPlants();

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

const upload = multer({ storage: storage });

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
      .project({ _id: 1, name: 1, waterFreq: 1 })
      .toArray();
    res.json(plants);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch plants" });
  }
});

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
app.get("/profile", requiredLogin, (req, res) => {
  res.render("profile.ejs", { name: req.session.username });
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

// Render the details page
app.get("/details/:species", requiredLogin, async (req, res) => {
  const species = req.params.species;
  const filePath = path.join(
    __dirname,
    "public",
    "descriptions",
    `${species}.md`,
  );

  let descriptionHtml = "";

  try {
    // Read the file content synchronously (simplest for this use case)
    const markdownString = fs.readFileSync(filePath, "utf8");
    // Convert to HTML
    descriptionHtml = marked.parse(markdownString);
  } catch (err) {
    // Fallback if the file doesn't exist
    descriptionHtml = `<p>No detailed description found for ${species}. Check back later!</p>`;
  }

  res.render("details.ejs", {
    species: req.params.species,
    descriptionHtml: descriptionHtml,
  });
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
