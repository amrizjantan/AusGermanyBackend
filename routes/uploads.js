import express from "express";
import multer from "multer";
import authenticateToken from "../middleware/authenticateToken.js";
import authorizeUserType from "../middleware/authorizeUserType.js";
import { supabase } from "../index.js";

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload Item Route
router.post(
  "/",
  authenticateToken,
  authorizeUserType(["both"]),
  upload.array("images"), // Allow multiple files under the field name "images"
  async (req, res) => {
    const { title, description, price } = req.body;

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
      const imageUploadPromises = req.files.map(async (file) => {
        const uniqueFileName = `uploads/${Date.now()}-${file.originalname}`;
        const { error } = await supabase.storage
          .from("uploads") // Supabase bucket name
          .upload(uniqueFileName, file.buffer, {
            contentType: file.mimetype, // Set the correct MIME type
          });

        if (error) {
          throw error;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("uploads").getPublicUrl(uniqueFileName);
        return publicUrl;
      });

      const uploadedImageUrls = await Promise.all(imageUploadPromises);

      const { error: dbError } = await supabase.from("uploads").insert([
        // Updated to 'uploads'
        {
          title,
          description,
          price,
          images: uploadedImageUrls, // Store the image URLs
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

// Admin Panel/Dashboard: Retrieve All Uploads
router.get("/admin/uploads", authenticateToken, async (req, res) => {
  try {
    const { data: uploads, error } = await supabase.from("uploads") // Updated to 'uploads'
      .select(`
        *,
        users(username, email) // Join user info if needed
      `);

    if (error) {
      console.error("Error retrieving uploads:", error);
      return res
        .status(500)
        .json({ message: "Failed to retrieve uploads", error });
    }

    res.status(200).json({ uploads });
  } catch (error) {
    console.error("Error retrieving uploads:", error);
    res.status(500).json({ message: "Server error", error });
  }
});

// Admin Panel/Dashboard: Approve Upload
router.put("/uploads/:id/approve", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from("uploads") // Updated to 'uploads'
      .update({ admin_status: "approved" }) // Assuming admin_status field exists
      .eq("item_id", id) // Assuming item_id is the primary key
      .select();

    if (error) {
      console.error("Error approving upload:", error);
      return res
        .status(500)
        .json({ message: "Failed to approve upload", error });
    }

    if (data.length === 0) {
      return res.status(404).json({ message: "Upload not found." });
    }

    res
      .status(200)
      .json({ message: "Upload approved successfully.", upload: data[0] });
  } catch (error) {
    console.error("Approve upload error:", error);
    res.status(500).json({ message: "Server error." });
  }
});

// Admin Panel/Dashboard: Reject Upload
router.put("/uploads/:id/reject", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from("uploads") // Updated to 'uploads'
      .update({ admin_status: "rejected" }) // Assuming admin_status field exists
      .eq("item_id", id) // Assuming item_id is the primary key
      .select();

    if (error) {
      console.error("Error rejecting upload:", error);
      return res
        .status(500)
        .json({ message: "Failed to reject upload", error });
    }

    if (data.length === 0) {
      return res.status(404).json({ message: "Upload not found." });
    }

    res.status(200).json({
      message: "Upload rejected successfully. The item will not be available.",
      upload: data[0],
    });
  } catch (error) {
    console.error("Reject upload error:", error);
    res.status(500).json({ message: "Server error." });
  }
});

export default router;
