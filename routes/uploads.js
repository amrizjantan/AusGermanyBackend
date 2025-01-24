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
    const { title, description, price, category, condition } = req.body; // Ensure condition is destructured

    // Check if all required fields (including condition) are present
    if (
      !title ||
      !description ||
      !price ||
      !category ||
      !condition || // Ensure condition is included
      !req.files ||
      req.files.length === 0
    ) {
      return res.status(400).json({
        message:
          "All fields (title, description, price, category, condition) are required, and at least one image must be uploaded.",
      });
    }

    const itemCategory = category || "Others";

    try {
      // Upload images to Supabase storage
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

        return `https://obpujqjuhucirpkdqidf.supabase.co/storage/v1/object/public/uploads/${data.path}`;
      });

      const uploadedImageUrls = await Promise.all(imageUploadPromises);

      // Insert item info into the database, including condition
      const { error: databaseInsertError } = await supabase
        .from("uploads")
        .insert([
          {
            title,
            description,
            price,
            condition, // Include condition in the database insert
            images: uploadedImageUrls,
            user_id: req.user.user_id,
            category: itemCategory,
          },
        ]);

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

// Admin: Retrieve all uploads
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
      condition,  
      users(username, email),
      translated_title,
      translated_description 
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

// Admin: Update + approve upload request
router.put("/:uploadId/approve", authenticateToken, async (req, res) => {
  const { uploadId } = req.params;
  const {
    postal_fee,
    service_fee,
    description,
    total_amount,
    translated_title,
    translated_description,
  } = req.body;

  try {
    const { data, error } = await supabase
      .from("uploads")
      .update({
        postal_fee,
        service_fee,
        description,
        total_amount,
        admin_status: "approved",
        translated_title,
        translated_description,
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

// Admin: Reject upload request
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

// Admin: Update fees
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

// Marketplace: (Public view) - Retrieve all approved uploads excluding user's own uploads
router.get("/", authenticateToken, async (req, res) => {
  const userId = req.user.user_id; // Get the current user's ID from the request

  try {
    // Add condition to filter out items that are sold, and exclude the current user's uploads
    const { data: uploads, error } = await supabase
      .from("uploads")
      .select("*")
      .eq("admin_status", "approved")
      .eq("is_sold", false) // Only fetch items that are not sold
      .neq("user_id", userId); // Exclude uploads by the current user

    if (error) {
      console.error("Error retrieving approved uploads:", error);
      return res
        .status(500)
        .json({ message: "Failed to retrieve uploads", error });
    }

    if (uploads.length === 0) {
      return res.status(200).json({ message: "No items available." });
    }

    res.status(200).json({ uploads });
  } catch (error) {
    console.error("Error retrieving uploads:", error);
    res.status(500).json({ message: "Server error", error });
  }
});

// Customer Dashboard: Retrieve own uploads or both own and liked uploads
router.get("/customer", authenticateToken, async (req, res) => {
  const { user_id } = req.user;

  try {
    // Fetch the user's own uploads
    const { data: ownUploads, error: ownUploadsError } = await supabase
      .from("uploads")
      .select("*")
      .eq("user_id", user_id);

    if (ownUploadsError) {
      console.error("Error retrieving own uploads:", ownUploadsError);
      return res.status(500).json({
        message: "Failed to retrieve own uploads",
        error: ownUploadsError,
      });
    }

    if (req.query.includeLiked === "true") {
      const { data: likedUploads, error: likedUploadsError } = await supabase
        .from("uploads")
        .select("*")
        .contains("favourites", [user_id]);
      if (likedUploadsError) {
        console.error("Error retrieving liked uploads:", likedUploadsError);
        return res.status(500).json({
          message: "Failed to retrieve liked uploads",
          error: likedUploadsError,
        });
      }

      return res.status(200).json({ ownUploads, likedUploads });
    }

    res.status(200).json({ ownUploads });
  } catch (error) {
    console.error("Error retrieving uploads:", error);
    return res.status(500).json({ message: "Server error", error });
  }
});

// Marketplace: (Public view) - Retrieve a single upload by its ID
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

// Marketplace: (Public view) Toggle favourite (like/unlike)
router.put("/:uploadId/like", authenticateToken, async (req, res) => {
  const { uploadId } = req.params;
  const userId = req.user.user_id;

  try {
    const { data: existingData, error: fetchError } = await supabase
      .from("uploads")
      .select("favourites")
      .eq("upload_id", uploadId)
      .single();

    if (fetchError) {
      console.error("Error fetching existing favourites:", fetchError);
      return res.status(500).json({
        message: "Failed to fetch existing favourites",
        error: fetchError,
      });
    }

    const currentFavourites = existingData?.favourites || [];

    const userIndex = currentFavourites.indexOf(userId);

    if (userIndex === -1) {
      currentFavourites.push(userId);
    } else {
      currentFavourites.splice(userIndex, 1);
    }

    const { data, error } = await supabase
      .from("uploads")
      .update({ favourites: currentFavourites })
      .eq("upload_id", uploadId)
      .select();

    if (error) {
      console.error("Error updating favourites:", error);
      return res
        .status(500)
        .json({ message: "Failed to update favourites.", error });
    }

    res.status(200).json({
      message:
        userIndex === -1
          ? "Item liked successfully."
          : "Item unliked successfully.",
      item: data[0],
    });
  } catch (error) {
    console.error("Error toggling like:", error);
    res.status(500).json({ message: "Server error", error });
  }
});

// User Dashbord: Users withdraw an upload
router.put("/:uploadId/withdraw", authenticateToken, async (req, res) => {
  const { uploadId } = req.params;
  const userId = req.user.user_id;

  try {
    const { data, error } = await supabase
      .from("uploads")
      .update({ admin_status: "withdrawn" })
      .eq("upload_id", uploadId)
      .eq("user_id", userId)
      .select();

    if (error) {
      console.error("Error withdrawing upload:", error);
      return res
        .status(500)
        .json({ message: "Failed to withdraw upload.", error });
    }

    if (!data.length) {
      return res.status(404).json({ message: "Upload not found." });
    }

    res.status(200).json({
      message: "Upload withdrawn successfully.",
      upload: data[0],
    });
  } catch (error) {
    console.error("Error withdrawing upload:", error);
    res.status(500).json({ message: "Server error.", error });
  }
});

// Marketplace: (Public view) when user buys item
router.put("/:uploadId/sold", authenticateToken, async (req, res) => {
  const { uploadId } = req.params;

  try {
    console.log("Attempting to mark as sold:", uploadId);

    // Fetch the upload to verify that it exists and has the correct is_sold status
    const { data: upload, error: fetchError } = await supabase
      .from("uploads")
      .select("upload_id, is_sold, user_id")
      .eq("upload_id", uploadId)
      .single();

    if (fetchError) {
      console.error("Error fetching upload:", fetchError);
      return res
        .status(500)
        .json({ message: "Failed to fetch upload", error: fetchError });
    }

    if (!upload) {
      console.error("Upload not found with uploadId:", uploadId);
      return res.status(404).json({ message: "Upload not found." });
    }

    console.log("Upload found:", upload);

    // Ensure the item is not already sold
    if (upload.is_sold) {
      console.log("Item is already marked as sold.");
      return res
        .status(400)
        .json({ message: "This item is already marked as sold." });
    }

    // Ensure the user trying to mark the item as sold is NOT the owner of the item
    if (upload.user_id === req.user.user_id) {
      console.log("User cannot buy their own item.");
      return res.status(400).json({ message: "You cannot buy your own item." });
    }

    // Proceed with the update
    const { data, error: updateError } = await supabase
      .from("uploads")
      .update({ is_sold: true })
      .eq("upload_id", uploadId)
      .select();

    if (updateError) {
      console.error("Error updating upload to mark as sold:", updateError);
      return res.status(500).json({
        message: "User cannot buy their own item.",
        error: updateError,
      });
    }

    if (!data || data.length === 0) {
      console.error("No data returned after the update.");
      return res
        .status(404)
        .json({ message: "Failed to mark upload as sold. Item not found." });
    }

    console.log("Upload marked as sold successfully:", data[0]);

    res.status(200).json({
      message: "Upload marked as sold successfully.",
      upload: data[0],
    });
  } catch (error) {
    console.error("Error in marking upload as sold:", error);
    res.status(500).json({ message: "Server error.", error });
  }
});

//Payment
router.get("/completed", authenticateToken, async (req, res) => {
  const userId = req.user.user_id;

  console.log("DEBUG: userId received from req.user:", userId); // Add this

  try {
    const { data, error } = await supabase
      .from("uploads")
      .select("*")
      .eq("user_id", userId) // Ensure this is a valid UUID
      .eq("is_sold", true);

    if (error) {
      console.error("Error fetching completed uploads:", error);
      return res
        .status(500)
        .json({ message: "Error fetching completed uploads", error });
    }

    if (data.length === 0) {
      return res.status(404).json({ message: "No completed uploads found." });
    }

    return res.status(200).json({ completedItems: data });
  } catch (error) {
    console.error("Error retrieving completed uploads:", error);
    return res.status(500).json({ message: "Server error", error });
  }
});

export default router;
