const express = require("express");
const router = express.Router();
const User = require("../models/User"); // Adjust the path if needed

// Endpoint to save a URL
router.post("/save-url", async (req, res) => {
  const { url } = req.body;
  const fixedUserId = "some-fixed-user-id"; // Replace with a valid user ID for testing

  if (!url) {
    return res.status(400).json({ message: "URL is required" });
  }

  try {
    console.log("Attempting to save URL:", url); // Debug log
    const user = await User.findById(fixedUserId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.urls.includes(url)) {
      user.urls.push(url);
      await user.save();
      console.log("URL saved successfully"); // Debug log
    } else {
      console.log("URL already exists"); // Debug log
    }

    res.status(200).json({ message: "URL saved successfully" });
  } catch (error) {
    console.error("Error saving URL:", error); // Debug log
    res.status(500).json({ message: "Error saving URL", error });
  }
});

module.exports = router;
