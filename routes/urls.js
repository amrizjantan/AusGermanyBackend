const express = require("express");
const router = express.Router();
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { check, validationResult } = require("express-validator");
const { scrapeUrl } = require("../utils/scraper"); // Importing the scraper

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader) {
    return res
      .status(401)
      .json({ message: "Access Denied. No token provided." });
  }

  const token = authHeader.replace("Bearer ", ""); // Remove 'Bearer ' prefix

  if (!token) {
    return res
      .status(401)
      .json({ message: "Access Denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach decoded token payload to req.user
    next();
  } catch (error) {
    res.status(400).json({ message: "Invalid token." });
  }
};

// Endpoint to save a URL (requires JWT authentication)
router.post(
  "/save-url",
  authenticateToken,
  [check("url", "URL is required").isURL()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { url } = req.body;

    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Use the scraper to get data from the URL
      const { title, price, imageUrl } = await scrapeUrl(url);

      if (!user.urls.some((item) => item.url === url)) {
        user.urls.push({ url, title, price, imageUrl });
        await user.save();
        res.status(200).json({ message: "URL saved successfully" });
      } else {
        res.status(400).json({ message: "URL already exists" });
      }
    } catch (error) {
      console.error("Error saving URL:", error);
      res.status(500).json({ message: "Server error", error });
    }
  }
);

// Endpoint to get all URLs for the authenticated user
router.get("/get-url", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId); // Extract userId from JWT
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ urls: user.urls });
  } catch (error) {
    console.error("Error fetching URLs:", error);
    res.status(500).json({ message: "Server error", error });
  }
});

module.exports = router;
