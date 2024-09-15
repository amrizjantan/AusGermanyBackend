import { Router } from "express";
import { check, validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import { scrapeUrl } from "../utils/scraper.js";
import User from "../models/User.js";

const router = Router();

const authenticateToken = (req, res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader) {
    return res
      .status(401)
      .json({ message: "Access Denied. No token provided." });
  }

  const token = authHeader.replace("Bearer ", "");

  if (!token) {
    return res
      .status(401)
      .json({ message: "Access Denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(400).json({ message: "Invalid token." });
  }
};

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

router.get("/get-url", authenticateToken, async (req, res) => {
  // Endpoint to get all URLs for the authenticated user
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

export default router;
