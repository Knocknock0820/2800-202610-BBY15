require("dotenv").config();

const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const bcrypt = require("bcrypt");
const Joi = require("joi");

const app = express();
const port = 3000;
const saltRounds = 12;
const expireTime = 24 * 60 * 60 * 1000;

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

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
  res.render("mainpage.ejs", { name: req.session.username });
});

app.get("/about", (req, res) => {
  res.render("about.ejs");
});

// Render the landing page
app.get("/landing", (req, res) => {
  res.render("landing.ejs");
});

// Render the login page
app.get("/login", (req, res) => {
  res.render("login.ejs", { error: null });
});

// Handle login form submission
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
app.get("/signup", (req, res) => {
  res.render("signup.ejs");
});

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
  res.redirect("/");
});

app.post("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/landing");
});

// Handle non-existent routes
app.use((req, res) => {
  res.status(404);
  res.render("404");
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
