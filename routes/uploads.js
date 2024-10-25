import { Router } from "express";
import multer from "multer"; // Import multer for handling file uploads
import authenticateToken from "../middleware/authenticateToken.js";
import authorizeUserType from "../middleware/authorizeUserType.js";
import { supabase } from "../index.js";

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post(
  "/upload",
  authenticateToken,
  authorizeUserType(["both"]),
  upload.array("images"), // Allow multiple files under the field name "images"
  async (req, res) => {
    console.log("User type from token:", req.user.user_type);

    const { title, description, price } = req.body;

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
        const uniqueFileName = `items/${Date.now()}-${file.originalname}`;
        const { data, error } = await supabase.storage
          .from("uploads") //  bucket name
          .upload(uniqueFileName, file.buffer, {
            contentType: file.mimetype, // Set the correct MIME type
          });

        if (error) {
          throw error;
        }

        return supabase.storage.from("uploads").getPublicUrl(uniqueFileName)
          .data.publicUrl;
      });

      const uploadedImageUrls = await Promise.all(imageUploadPromises);

      //saving
      const { error: dbError } = await supabase.from("items").insert([
        {
          title,
          description,
          price,
          images: uploadedImageUrls,
          user_id: req.user.user_id, // Associate item with the logged-in user
        },
      ]);

      if (dbError) {
        throw dbError;
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

export default router;
