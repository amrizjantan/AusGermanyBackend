import { Router } from "express";
import multer from "multer"; // Import multer for handling file uploads
import authenticateToken from "../middleware/authenticateToken.js";
import authorizeUserType from "../middleware/authorizeUserType.js";
import { supabase } from "../index.js"; // Import supabase client

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage(); // Store files in memory for simplicity
const upload = multer({ storage });

// Route for uploading items
router.post(
  "/upload",
  authenticateToken, // Middleware to check for a valid token
  authorizeUserType(["both"]), // Middleware to check user type
  upload.array("images"), // Allow multiple files under the field name "images"
  async (req, res) => {
    // Log the user type for debugging
    console.log("User type from token:", req.user.user_type);

    // Extract item data from the request body
    const { title, description, price } = req.body; // Ensure these are included in the request

    // Check if the required fields are provided
    if (
      !title ||
      !description ||
      !price ||
      !req.files ||
      req.files.length === 0
    ) {
      return res.status(400).json({
        message:
          "All fields are required and at least one image must be uploaded.",
      });
    }

    try {
      // Upload images to Supabase Storage
      const imageUploadPromises = req.files.map(async (file) => {
        const { data, error } = await supabase.storage
          .from("uploads") // Use the bucket name you just created
          .upload(`items/${file.originalname}`, file.buffer); // Use the buffer from multer

        if (error) {
          throw error; // Throw error if upload fails
        }

        return data.Key; // Return the uploaded file's key
      });

      const uploadedImageKeys = await Promise.all(imageUploadPromises);

      // Save item details to your database
      const { error: dbError } = await supabase
        .from("items") // Replace with your items table name
        .insert([
          {
            title,
            description,
            price,
            images: uploadedImageKeys, // Store image keys in your database
            user_id: req.user.user_id, // Associate item with the logged-in user
          },
        ]);

      if (dbError) {
        throw dbError; // Throw error if database insert fails
      }

      res.status(200).json({ message: "Item uploaded successfully!" });
    } catch (error) {
      console.error("Upload error:", error);
      res
        .status(500)
        .json({ message: "Failed to upload item", error: error.message });
    }
  }
);

export default router; // Ensure to export the router
