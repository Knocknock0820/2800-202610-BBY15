// Setting up server, routes, and connecting to MongoDB all hand written.
// Unless mentioned otherwise in the comments.
// Modified by: Harun Yaprak

require("dotenv").config();

const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const bcrypt = require("bcrypt");
const Joi = require("joi");

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

// Load plant files and seed on startup
(async () => {
  try {
    await loadPlantsWithFiles();
    await seedPlants(plantCollection);
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

function requiredLogin(req, res, next) {
  if (!req.session.authenticated) {
    res.redirect("/landing");
  } else {
    next();
  }
}

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
      .project({ _id: 1, name: 1, waterFreq: 1, slug: 1 })
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

    // Convert base64 to buffer and serve with correct mime type
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

      // Convert base64 to buffer and serve with correct mime type
      const buffer = Buffer.from(plant.images[imageName], "base64");
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
app.get("/profile", requiredLogin, (req, res) => {
  res.render("profile.ejs", { name: req.session.username });
});

//   Render the community page
app.get("/community", requiredLogin, (req, res) => {
  res.render("community.ejs", { name: req.session.username });
});

// Render the details page
//Modified by: Steven Chi
app.get("/details/:slug", requiredLogin, async (req, res) => {
  const slug = req.params.slug;

  function toDataUrl(base64String) {
    if (!base64String) {
      return null;
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
    });
  } catch (err) {
    console.error("Error fetching plant details:", err);
    res.status(500).render("404");
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
