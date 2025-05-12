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

app.use(express.static("static"));
app.set("view engine", "pug");
app.set("views", "./app/views");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
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

const csrfProtection = csrf();
app.use(csrfProtection);

app.use((req, res, next) => {
  res.locals.loggedIn = req.session.loggedIn || false;
  res.locals.username = req.session.username || null;
  res.locals.csrfToken = req.csrfToken();
  res.locals.url = req.url;
  next();
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("error", { message: "Something went wrong!" });
});

app.get("/", (req, res) => {
  res.render("home", {
    message: req.query.message || null,
    error: req.query.error || null
  });
});

app.get("/men", async (req, res) => {
  const items = await db.query("SELECT * FROM items WHERE category = ?", ["men"]);
  res.render("men", { items });
});

app.get("/women", async (req, res) => {
  const items = await db.query("SELECT * FROM items WHERE category = ?", ["women"]);
  res.render("women", { items });
});

app.get("/kids", async (req, res) => {
  const items = await db.query("SELECT * FROM items WHERE category = ?", ["kids"]);
  res.render("kids", { items });
});

app.get("/accessories", async (req, res) => {
  const items = await db.query("SELECT * FROM items WHERE category = ?", ["accessories"]);
  res.render("accessories", { items });
});

app.get("/offers", async (req, res) => {
  const items = await db.query("SELECT * FROM items WHERE category = ?", ["offers"]);
  res.render("offers", { items });
});

app.get("/cart", async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  const message = req.session.message || null;
  const error = req.session.error || null;
  req.session.message = null;
  req.session.error = null;
  const cartItems = await db.query("SELECT * FROM cart WHERE user_id = ?", [req.session.uid]);
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  res.render("cart", { cartItems, total, message, error });
});

app.post("/cart/add/:id", async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  const itemId = req.params.id;
  const item = await db.query("SELECT * FROM items WHERE id = ?", [itemId]);
  if (!item[0]) {
    req.session.error = "Item not found";
    return res.redirect("/cart");
  }

  try {
    await db.query(
      "INSERT INTO cart (user_id, item_id, name, image, description, price, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [req.session.uid, itemId, item[0].name, item[0].image, item[0].description, item[0].price, 1]
    );
    req.session.message = "Item added to cart!";
    res.redirect("/cart");
  } catch (err) {
    console.error("Error adding to cart:", err);
    req.session.error = "Failed to add item to cart";
    res.redirect("/cart");
  }
});

app.get("/cart/remove/:id", async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  try {
    await db.query("DELETE FROM cart WHERE id = ? AND user_id = ?", [req.params.id, req.session.uid]);
    req.session.message = "Item removed from cart";
    res.redirect("/cart");
  } catch (err) {
    console.error("Error removing from cart:", err);
    req.session.error = "Failed to remove item from cart";
    res.redirect("/cart");
  }
});

app.get("/wishlist", async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  const message = req.session.message || null;
  const error = req.session.error || null;
  req.session.message = null;
  req.session.error = null;
  const wishlistItems = await db.query("SELECT * FROM wishlist WHERE user_id = ?", [req.session.uid]);
  res.render("wishlist", { wishlistItems, message, error });
});

app.post("/wishlist/add/:id", async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  const itemId = req.params.id;
  const item = await db.query("SELECT * FROM items WHERE id = ?", [itemId]);
  if (!item[0]) {
    req.session.error = "Item not found";
    return res.redirect("/wishlist");
  }

  try {
    await db.query(
      "INSERT INTO wishlist (user_id, item_id, name, image, description, price) VALUES (?, ?, ?, ?, ?, ?)",
      [req.session.uid, itemId, item[0].name, item[0].image, item[0].description, item[0].price]
    );
    req.session.message = "Item added to wishlist!";
    res.redirect("/wishlist");
  } catch (err) {
    console.error("Error adding to wishlist:", err);
    if (err.code === "ER_DUP_ENTRY") {
      req.session.error = "Item already in wishlist";
    } else {
      req.session.error = "Failed to add item to wishlist";
    }
    res.redirect("/wishlist");
  }
});

app.get("/wishlist/remove/:id", async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  try {
    await db.query("DELETE FROM wishlist WHERE id = ? AND user_id = ?", [req.params.id, req.session.uid]);
    req.session.message = "Item removed from wishlist";
    res.redirect("/wishlist");
  } catch (err) {
    console.error("Error removing from wishlist:", err);
    req.session.error = "Failed to remove item from wishlist";
    res.redirect("/wishlist");
  }
});

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      res.status(500).render("error", { message: "Could not log out." });
    } else {
      res.clearCookie("connect.sid");
      res.redirect("/login");
    }
  });
});

app.post(
  "/authenticate",
  [
    body("email").isEmail().normalizeEmail().withMessage("Invalid email"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render("login", { error: errors.array()[0].msg });
    }

    const { email, password } = req.body;
    const user = new User(email);
    try {
      const uId = await user.getIdFromEmail();
      if (!uId) {
        return res.render("login", { error: "Email not registered" });
      }

      user.id = uId;
      const match = await user.authenticate(password);
      if (!match) {
        return res.render("login", { error: "Incorrect password" });
      }

      const username = await user.getNameFromId(uId);
      req.session.uid = uId;
      req.session.loggedIn = true;
      req.session.username = username;
      req.session.email = email;

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).render("error", { message: "Session error" });
        }
        res.redirect("/");
      });
    } catch (err) {
      console.error("Authentication error:", err.message);
      res.render("login", { error: "An error occurred. Please try again." });
    }
  }
);

app.get("/signup", (req, res) => {
  res.render("signup", { error: null, name: '', email: '' });
});

app.post(
  "/submit",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().normalizeEmail().withMessage("Invalid email"),
    body("password").custom((value) => {
      if (value.length < 8) {
        throw new Error("Password must be at least 8 characters long");
      }
      if (!/[A-Z]/.test(value)) {
        throw new Error("Password must contain at least one uppercase letter");
      }
      if (!/[a-z]/.test(value)) {
        throw new Error("Password must contain at least one lowercase letter");
      }
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
        throw new Error("Password must contain at least one special character");
      }
      return true;
    }),
    body("confirm-password").custom((value, { req }) => value === req.body.password).withMessage("Passwords do not match"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render("signup", {
        error: errors.array()[0].msg,
        name: req.body.name || '',
        email: req.body.email || ''
      });
    }

    const { name, email, password } = req.body;
    const user = new User(email, name);

    try {
      const existingId = await user.getIdFromEmail();
      if (existingId) {
        return res.render("signup", {
          error: "Email already exists",
          name,
          email
        });
      }

      await user.addUser(password);
      res.redirect("/login");
    } catch (error) {
      console.error("Error registering user:", error.message);
      if (error.code === "ER_DUP_ENTRY") {
        return res.render("signup", {
          error: "Email already exists",
          name,
          email
        });
      }
      res.render("signup", {
        error: "An error occurred while registering. Please try again.",
        name,
        email
      });
    }
  }
);

app.get("/forgot", (req, res) => {
  res.render("forgot", { message: null });
});

app.post(
  "/forgot",
  [body("email").isEmail().normalizeEmail().withMessage("Invalid email")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render("forgot", { message: errors.array()[0].msg });
    }

    const email = req.body.email;
    const user = new User(email);
    const id = await user.getIdFromEmail();

    if (!id) {
      return res.render("forgot", { message: "Email not found. Please check and try again." });
    }

    const token = crypto.randomBytes(20).toString("hex");
    await user.setResetToken(token);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset Link",
      text: `Click the link to reset your password: ${BASE_URL}/reset/${token}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        return res.render("forgot", { message: "Error sending the email. Please try again later." });
      }
      console.log("Email sent: " + info.response);
      res.render("forgot", { message: "Password reset link has been sent to your email." });
    });
  }
);

app.get("/reset/:token", async (req, res) => {
  const user = await User.getUserByToken(req.params.token);
  if (!user) return res.render("error", { message: "Invalid or expired token" });
  res.render("reset", { token: req.params.token, error: null });
});

app.post(
  "/reset/:token",
  [
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("confirm").custom((value, { req }) => value === req.body.password).withMessage("Passwords do not match"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render("reset", { token: req.params.token, error: errors.array()[0].msg });
    }

    const { password } = req.body;
    const user = await User.getUserByToken(req.params.token);
    if (!user) return res.render("error", { message: "Invalid or expired token" });

    await user.updatePassword(password);
    res.redirect("/login");
  }
);

app.get("/about", (req, res) => {
  res.render("about");
});

app.get("/mission", (req, res) => {
  res.render("mission");
});

app.get("/profile", async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");

  const user = new User(req.session.email);
  const userDetails = await user.getUserDetails();
  const addresses = await user.getAddresses();

  res.render("profile", { userDetails, addresses });
});

app.post(
  "/profile/update",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("phone_number").trim().notEmpty().withMessage("Phone number is required"),
    body("date_of_birth").notEmpty().withMessage("Date of birth is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const user = new User(req.session.email);
      const userDetails = await user.getUserDetails();
      const addresses = await user.getAddresses();
      return res.render("profile", { userDetails, addresses, error: errors.array()[0].msg });
    }

    const { name, phone_number, gender, date_of_birth } = req.body;
    const user = new User(req.session.email);

    const success = await user.updateUserDetails(name, phone_number, gender, date_of_birth);
    if (success) {
      req.session.username = name;
      res.redirect("/profile");
    } else {
      res.render("error", { message: "Error updating profile" });
    }
  }
);

app.get("/profile/address/add", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  res.render("address_form", { action: "/profile/address/add", address: {}, error: null });
});

app.post(
  "/profile/address/add",
  [
    body("address_type").trim().notEmpty().withMessage("Address type is required"),
    body("address_line1").trim().notEmpty().withMessage("Address line 1 is required"),
    body("city").trim().notEmpty().withMessage("City is required"),
    body("state").trim().notEmpty().withMessage("State is required"),
    body("country").trim().notEmpty().withMessage("Country is required"),
    body("postal_code").trim().notEmpty().withMessage("Postal code is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render("address_form", { action: "/profile/address/add", address: req.body, error: errors.array()[0].msg });
    }

    const { address_type, address_line1, address_line2, city, state, country, postal_code } = req.body;
    const user = new User(req.session.email);
    await user.getIdFromEmail();

    const success = await user.addAddress(address_type, address_line1, address_line2, city, state, country, postal_code);
    if (success) {
      res.redirect("/profile");
    } else {
      res.render("error", { message: "Error adding address" });
    }
  }
);

app.get("/profile/address/update/:id", async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  const address = await db.query("SELECT * FROM addresses WHERE id = ? AND user_id = ?", [req.params.id, req.session.uid]);
  if (!address[0]) return res.render("error", { message: "Address not found" });
  res.render("address_form", { action: `/profile/address/update/${req.params.id}`, address: address[0], error: null });
});

app.post(
  "/profile/address/update/:id",
  [
    body("address_type").trim().notEmpty().withMessage("Address type is required"),
    body("address_line1").trim().notEmpty().withMessage("Address line 1 is required"),
    body("city").trim().notEmpty().withMessage("City is required"),
    body("state").trim().notEmpty().withMessage("State is required"),
    body("country").trim().notEmpty().withMessage("Country is required"),
    body("postal_code").trim().notEmpty().withMessage("Postal code is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render("address_form", {
        action: `/profile/address/update/${req.params.id}`,
        address: req.body,
        error: errors.array()[0].msg,
      });
    }

    const { address_type, address_line1, address_line2, city, state, country, postal_code } = req.body;
    const user = new User(req.session.email);
    await user.getIdFromEmail();

    const success = await user.updateAddress(req.params.id, address_type, address_line1, address_line2, city, state, country, postal_code);
    if (success) {
      res.redirect("/profile");
    } else {
      res.render("error", { message: "Error updating address" });
    }
  }
);

app.get("/profile/address/delete/:id", async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  const user = new User(req.session.email);
  await user.getIdFromEmail();

  const success = await user.deleteAddress(req.params.id);
  if (success) {
    res.redirect("/profile");
  } else {
    res.render("error", { message: "Error deleting address" });
  }
});

app.get("/orders", async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  const orders = await db.query(
    "SELECT o.*, oi.item_id, oi.name, oi.price, oi.quantity FROM orders o JOIN order_items oi ON o.id = oi.order_id WHERE o.user_id = ?",
    [req.session.uid]
  );
  res.render("orders", { orders });
});

app.post(
  "/subscribe",
  [body("email").isEmail().normalizeEmail().withMessage("Invalid email")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.redirect("/?error" + encodeURIComponent(errors.array()[0].msg));
    }

    const { email } = req.body;
    try {
      await db.query("INSERT INTO subscribers (email) VALUES (?)", [email]);
      res.redirect("/?message"  + encodeURIComponent("Subscribed successfully"));
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        res.redirect("/?error" + encodeURIComponent("Email already subscribed"));
      } else {
        res.redirect("/?error=" + encodeURIComponent("An error occurred while subscribing. Please try again."));
      }
    }
  }
);

app.get("/checkout", async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  const user = new User(req.session.email);
  const cartItems = await db.query("SELECT * FROM cart WHERE user_id = ?", [req.session.uid]);
  const addresses = await user.getAddresses();
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  res.render("checkout", { cartItems, addresses, total });
});

app.post("/checkout", async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/login");
  const { address_id } = req.body;
  const cartItems = await db.query("SELECT * FROM cart WHERE user_id = ?", [req.session.uid]);

  if (!cartItems.length) return res.redirect("/cart?error=Cart is empty");

  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const order = await db.query(
    "INSERT INTO orders (user_id, address_id, total, status) VALUES (?, ?, ?, ?)",
    [req.session.uid, address_id, total, "pending"]
  );

  for (const item of cartItems) {
    await db.query(
      "INSERT INTO order_items (order_id, item_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)",
      [order.insertId, item.item_id, item.name, item.price, item.quantity]
    );
  }

  await db.query("DELETE FROM cart WHERE user_id = ?", [req.session.uid]);
  res.redirect("/orders");
});

app.get("/product/:id", async (req, res) => {
  const item = await db.query("SELECT * FROM items WHERE id = ?", [req.params.id]);
  if (!item[0]) return res.render("error", { message: "Product not found" });
  res.render("product", { item: item[0] });
});

app.listen(3000, () => {
  console.log("Server running at http://127.0.0.1:3000/");
});