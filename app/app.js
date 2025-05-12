// Required dependencies
const express = require("express");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { body, validationResult } = require("express-validator");
const csrf = require("csurf");

const app = express();
const db = require("./services/db");
const { User } = require("./models/users");

// Set up static files, view engine
app.use(express.static("static"));
app.set("view engine", "pug");
app.set("views", "./app/views");

// Body parsing middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session setup
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your_secret_key",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      httpOnly: true,
    },
  })
);

// CSRF protection
const csrfProtection = csrf();
app.use(csrfProtection);

// Make session data available in all templates
app.use((req, res, next) => {
  res.locals.loggedIn = req.session.loggedIn || false;
  res.locals.username = req.session.username || null;
  res.locals.csrfToken = req.csrfToken();
  res.locals.url = req.url;
  next();
});

// Generic error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("error", { message: "Something went wrong!" });
});

// Routes

// Home page
app.get("/", (req, res) => {
  res.render("home", { message: req.query.message || null, error: req.query.error || null });
});

// Product category pages
app.get("/men", async (req, res) => res.render("men", { items: await db.query("SELECT * FROM items WHERE category = ?", ["men"]) }));
app.get("/women", async (req, res) => res.render("women", { items: await db.query("SELECT * FROM items WHERE category = ?", ["women"]) }));
app.get("/kids", async (req, res) => res.render("kids", { items: await db.query("SELECT * FROM items WHERE category = ?", ["kids"]) }));
app.get("/accessories", async (req, res) => res.render("accessories", { items: await db.query("SELECT * FROM items WHERE category = ?", ["accessories"]) }));
app.get("/offers", async (req, res) => res.render("offers", { items: await db.query("SELECT * FROM items WHERE category = ?", ["offers"]) }));

// Cart routes (login required)
app.get("/cart", async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  const cartItems = await db.query("SELECT * FROM cart WHERE user_id = ?", [req.session.uid]);
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  res.render("cart", { cartItems, total, message: req.session.message, error: req.session.error });
  req.session.message = null; req.session.error = null;
});
app.post("/cart/add/:id", async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  const item = await db.query("SELECT * FROM items WHERE id = ?", [req.params.id]);
  if (!item[0]) { req.session.error = "Item not found"; return res.redirect("/cart"); }
  try {
    await db.query("INSERT INTO cart (user_id, item_id, name, image, description, price, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [req.session.uid, req.params.id, item[0].name, item[0].image, item[0].description, item[0].price, 1]);
    req.session.message = "Item added to cart!";
  } catch {
    req.session.error = "Failed to add item to cart";
  }
  res.redirect("/cart");
});
app.get("/cart/remove/:id", async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  try {
    await db.query("DELETE FROM cart WHERE id = ? AND user_id = ?", [req.params.id, req.session.uid]);
    req.session.message = "Item removed from cart";
  } catch {
    req.session.error = "Failed to remove item from cart";
  }
  res.redirect("/cart");
});

// Wishlist routes (login required)
app.get("/wishlist", async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  const wishlistItems = await db.query("SELECT * FROM wishlist WHERE user_id = ?", [req.session.uid]);
  res.render("wishlist", { wishlistItems, message: req.session.message, error: req.session.error });
  req.session.message = null; req.session.error = null;
});
app.post("/wishlist/add/:id", async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  const item = await db.query("SELECT * FROM items WHERE id = ?", [req.params.id]);
  if (!item[0]) { req.session.error = "Item not found"; return res.redirect("/wishlist"); }
  try {
    await db.query("INSERT INTO wishlist (user_id, item_id, name, image, description, price) VALUES (?, ?, ?, ?, ?, ?)",
      [req.session.uid, req.params.id, item[0].name, item[0].image, item[0].description, item[0].price]);
    req.session.message = "Item added to wishlist!";
  } catch (err) {
    req.session.error = err.code === "ER_DUP_ENTRY" ? "Item already in wishlist" : "Failed to add item to wishlist";
  }
  res.redirect("/wishlist");
});
app.get("/wishlist/remove/:id", async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  try {
    await db.query("DELETE FROM wishlist WHERE id = ? AND user_id = ?", [req.params.id, req.session.uid]);
    req.session.message = "Item removed from wishlist";
  } catch {
    req.session.error = "Failed to remove item from wishlist";
  }
  res.redirect("/wishlist");
});

// Login, logout, signup
app.get("/login", (req, res) => res.render("login", { error: null }));
app.get("/logout", (req, res) => req.session.destroy(err => {
  if (err) res.status(500).render("error", { message: "Could not log out." });
  else { res.clearCookie("connect.sid"); res.redirect("/login"); }
}));
app.post("/authenticate", [
  body("email").isEmail().normalizeEmail().withMessage("Invalid email"),
  body("password").notEmpty().withMessage("Password is required")
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.render("login", { error: errors.array()[0].msg });
  const { email, password } = req.body;
  const user = new User(email);
  try {
    const uId = await user.getIdFromEmail();
    if (!uId) return res.render("login", { error: "Email not registered" });
    user.id = uId;
    if (!(await user.authenticate(password))) return res.render("login", { error: "Incorrect password" });
    const username = await user.getNameFromId(uId);
    Object.assign(req.session, { uid: uId, loggedIn: true, username, email });
    req.session.save(err => {
      if (err) res.status(500).render("error", { message: "Session error" });
      else res.redirect("/");
    });
  } catch {
    res.render("login", { error: "An error occurred. Please try again." });
  }
});
app.get("/signup", (req, res) => res.render("signup", { error: null, name: '', email: '' }));
app.post("/submit", [
  body("name").notEmpty().withMessage("Name is required"),
  body("email").isEmail().normalizeEmail().withMessage("Invalid email"),
  body("password").custom(val => {
    if (val.length < 8) throw new Error("Password must be at least 8 characters");
    if (!/[A-Z]/.test(val)) throw new Error("Must contain uppercase letter");
    if (!/[a-z]/.test(val)) throw new Error("Must contain lowercase letter");
    if (!/[!@#$%^&*]/.test(val)) throw new Error("Must contain special character");
    return true;
  }),
  body("confirm-password").custom((val, { req }) => val === req.body.password).withMessage("Passwords do not match")
], async (req, res) => {
  const errors = validationResult(req);
  const { name, email, password } = req.body;
  if (!errors.isEmpty()) return res.render("signup", { error: errors.array()[0].msg, name, email });
  const user = new User(email, name);
  try {
    if (await user.getIdFromEmail()) return res.render("signup", { error: "Email already exists", name, email });
    await user.save(password);
    const uid = await user.getIdFromEmail();
    Object.assign(req.session, { uid, loggedIn: true, username: name, email });
    res.redirect("/");
  } catch {
    res.render("signup", { error: "Registration failed", name, email });
  }
});

// Start server
app.listen(3000, () => console.log("Server started on http://localhost:3000"));
