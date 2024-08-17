const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Endpoint to save a URL
router.post("/save-url", async (req, res) => {
  const { url } = req.body;
  const userId = "66c0ae8793f4ecceefeb6371"; // JUST FOR

  if (!url) {
    return res.status(400).json({ message: "URL is required" });
  }

  try {
    const user = await User.findById(userId); // Use userId here
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
});

module.exports = router;
