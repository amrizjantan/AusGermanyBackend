const express = require("express");
const router = express.Router();
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { check, validationResult } = require("express-validator");

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  // Log the token for debugging
  console.log("Extracted token:", token);
  // Extract token from headers
  const token = req.header("Authorization").replace("Bearer ", "");
  // Log the token for debugging
  console.log("Extracted token:", token);

  if (!token) {
    console.log("No token provided");
    return res
      .status(401)
      .json({ message: "Access Denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Token decoded:", decoded);
    req.user = decoded; // Assuming JWT payload contains user data
    next();
  } catch (error) {
    console.log("Error decoding token:", error.message);
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
      const user = await User.findById(req.user.userId); // Extract userId from the decoded JWT
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.urls.includes(url)) {
        user.urls.push(url);
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

module.exports = router;
