import express from "express";
import multer from "multer";
import authenticateToken from "../middleware/authenticateToken.js";
import authorizeUserType from "../middleware/authorizeUserType.js";
import { supabase } from "../index.js";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post(
  "/",
  authenticateToken,
  authorizeUserType(["both"]),
  upload.array("images"),
  async (req, res) => {
    const { title, description, price, category } = req.body;

    // Validate that all required fields are present
    if (
      !title ||
      !description ||
      !price ||
      !category ||
      !req.files ||
      req.files.length === 0
    ) {
      return res.status(400).json({
        message:
          "All fields (title, description, price, category) are required, and at least one image must be uploaded.",
      });
    }

    const itemCategory = category || "Others";

    try {
      // Process and upload images to Supabase
      const imageUploadPromises = req.files.map(async (file) => {
        const uniqueFileName = `${Date.now()}-${file.originalname}`;

        const { data, error: uploadError } = await supabase.storage
          .from("uploads")
          .upload(uniqueFileName, file.buffer, { contentType: file.mimetype });

        if (uploadError) {
          console.error("Error uploading file to Supabase:", uploadError);
          throw uploadError;
        }

        if (!data?.path) {
          throw new Error(
            `Could not retrieve image URL after upload of: ${file.originalname}`
          );
        }

        // Return the full URL of the uploaded image
        return `https://obpujqjuhucirpkdqidf.supabase.co/storage/v1/object/public/${data.path}`;
      });

      // Await the image upload promises
      const uploadedImageUrls = await Promise.all(imageUploadPromises);

      // Insert data into Supabase database
      const { error: databaseInsertError } = await supabase
        .from("uploads")
        .insert([
          {
            title,
            description,
            price,
            images: uploadedImageUrls,
            user_id: req.user.user_id,
            category: itemCategory,
          },
        ]);

      // If insertion fails, delete the uploaded images from storage
      if (databaseInsertError) {
        const { error: storageDeleteError } = await supabase.storage
          .from("uploads")
          .remove(uploadedImageUrls.map((url) => url.split("/").pop()));

        console.error(
          "Error inserting data into database:",
          databaseInsertError
        );
        if (storageDeleteError) {
          console.error(
            "Error deleting images from storage:",
            storageDeleteError
          );
        }

        throw databaseInsertError;
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

// Route to retrieve all uploads for admin dashboard
router.get("/admin/uploads", authenticateToken, async (req, res) => {
  try {
    const { data: uploads, error } = await supabase.from("uploads").select(`
        upload_id,
        user_id,
        images,
        title,
        description,
        price,
        postal_fee,
        service_fee,
        total_amount,
        admin_status,
        category,
        users(username, email)
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

// Update to approve upload
router.put("/:uploadId/approve", authenticateToken, async (req, res) => {
  const { uploadId } = req.params;
  const { postal_fee, service_fee, description, total_amount } = req.body;

  try {
    const { data, error } = await supabase
      .from("uploads")
      .update({
        postal_fee,
        service_fee,
        description,
        total_amount,
        admin_status: "approved",
      })
      .eq("upload_id", uploadId)
      .select();

    if (error) {
      console.error("Error approving upload:", error);
      return res
        .status(500)
        .json({ message: "Error approving upload.", error });
    }

    if (!data?.length) {
      return res.status(404).json({ message: "Upload not found." });
    }

    res.status(200).json({
      message: "Upload approved successfully.",
      upload: data[0],
    });
  } catch (error) {
    console.error("Error updating upload:", error);
    return res.status(500).json({ message: "Error updating upload.", error });
  }
});

// Reject upload route
router.put("/:id/reject", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from("uploads")
      .update({ admin_status: "rejected" })
      .eq("upload_id", id)
      .select();

    if (error) {
      console.error("Error rejecting upload:", error);
      return res
        .status(500)
        .json({ message: "Failed to reject upload", error });
    }

    if (!data?.length) {
      return res.status(404).json({ message: "Upload not found." });
    }

    res.status(200).json({
      message: "Upload rejected successfully.",
      upload: data[0],
    });
  } catch (error) {
    console.error("Reject error:", error);
    res.status(500).json({ message: "Server error.", error });
  }
});

// Update fees for an upload
router.put("/:id/fees", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { postal_fee, service_fee, total_amount } = req.body;

  if (postal_fee == null || service_fee == null || total_amount == null) {
    return res.status(400).json({
      message: "postal_fee, service_fee, and total_amount are required.",
    });
  }

  try {
    const { data, error } = await supabase
      .from("uploads")
      .update({ postal_fee, service_fee, total_amount })
      .eq("upload_id", id)
      .select();

    if (error) {
      console.error("Error updating fees:", error);
      return res.status(500).json({ message: "Failed to update fees", error });
    }

    if (!data?.length) {
      return res.status(404).json({ message: "Upload not found." });
    }

    res.status(200).json({
      message: "Fees updated successfully.",
      upload: data[0],
    });
  } catch (error) {
    console.error("Update fees error:", error);
    res.status(500).json({ message: "Server error.", error });
  }
});

// Retrieve all approved uploads
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { data: uploads, error } = await supabase
      .from("uploads")
      .select("*")
      .eq("admin_status", "approved");

    if (error) {
      console.error("Error retrieving approved uploads:", error);
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

// Retrieve upload by ID
router.get("/:uploadId", async (req, res) => {
  const { uploadId } = req.params;

  try {
    const { data, error } = await supabase
      .from("uploads")
      .select("*")
      .eq("upload_id", uploadId)
      .single();

    if (error) {
      console.error("Error retrieving upload:", error);
      return res
        .status(500)
        .json({ message: "Failed to retrieve upload", error });
    }

    if (!data) {
      return res.status(404).json({ message: "Upload not found." });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching upload:", error);
    return res.status(500).json({ message: "Server error.", error });
  }
});

export default router;
