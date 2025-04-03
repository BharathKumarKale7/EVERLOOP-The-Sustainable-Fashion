// Import express.js
const express = require("express");
const bcrypt = require("bcryptjs");
const session = require("express-session");
// Create express app
var app = express();

// Add static files location
app.use(express.static("static"));

app.set('view engine', 'pug');
app.set('views', './app/views');

// Get the functions in the db.js file to use
const db = require('./services/db');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
    session({
        secret: "your_secret_key",
        resave: false,
        saveUninitialized: false,
    })
);

// Create a route for root - /
app.get("/", function(req, res) {
    res.render("home");
});

app.get("/wishlist", function(req, res) {
    res.render("wishlist");
});

app.get("/login", function(req, res) {
    res.render("login");
});

app.get("/signup", function(req, res) {
    res.render("signup");
});

app.post("/submit", async (req, res) => {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        await db.query("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [
            name,
            email,
            hashedPassword,
        ]);
        res.redirect("/login");
    } catch (error) {
        console.error(error);
        res.send("Error registering user");
    }
});

app.get("/login", async (req, res) => {
    console.log("Login Request Received:", req.body);

    const { email, password } = req.body;

    try {
        const [users] = await db.query("SELECT * FROM users WHERE email = ?", [email]);

        if (users.length > 0) {
            const user = users[0];
            console.log("User found:", user);

            const isMatch = await bcrypt.compare(password, user.password);
            console.log("Password match:", isMatch);

            if (isMatch) {
                req.session.user = user;
                res.render("/home"); // Redirect after login
            } else {
                res.send("Incorrect password");
            }
        } else {
            res.send("User not found");
        }
    } catch (error) {
        console.error("Login error:", error);
        res.send("Error logging in");
    }
});

// Start server on port 3000
app.listen(3000,function(){
    console.log(`Server running at http://127.0.0.1:3000/`);
});