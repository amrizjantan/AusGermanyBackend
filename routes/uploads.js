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
    const { title, description, price, category, condition } = req.body;

    // Check if all required fields (including condition) are present
    if (
      !title ||
      !description ||
      !price ||
      !category ||
      !condition ||
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
            condition,
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
// User Dashboard: Users withdraw an upload
router.put("/:uploadId/withdraw", authenticateToken, async (req, res) => {
  const { uploadId } = req.params;
  const userId = req.user.user_id; // Get the user ID from the authenticated user

  try {
    // Retrieve the upload from the database
    const { data: upload, error: fetchError } = await supabase
      .from("uploads")
      .select("*")
      .eq("upload_id", uploadId)
      .eq("user_id", userId) // Ensure it's the correct user
      .single();

    if (fetchError) {
      return res.status(500).json({ message: "Error fetching upload." });
    }

    // Check if the item has been sold (bought_by is populated)
    if (upload?.bought_by) {
      return res.status(400).json({
        message: "This item has already been sold and cannot be withdrawn.",
      });
    }

    // Proceed to update the upload's status to withdrawn
    const { data, error } = await supabase
      .from("uploads")
      .update({ admin_status: "withdrawn" })
      .eq("upload_id", uploadId)
      .eq("user_id", userId) // Ensure the user is the owner
      .select();

    if (error) {
      console.error("Error withdrawing upload:", error);
      return res.status(500).json({ message: "Failed to withdraw upload." });
    }

    if (!data?.length) {
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

// Marketplace: (Public view) - Retrieve all approved uploads excluding user's own uploads and sold item
router.get("/", authenticateToken, async (req, res) => {
  const userId = req.user.user_id;

  try {
    // Query to get items that are approved, unsold, and not uploaded by the logged-in user
    const { data: uploads, error } = await supabase
      .from("uploads")
      .select("*")
      .eq("admin_status", "approved")
      .neq("user_id", userId) // Exclude the logged-in user's uploads
      .is("bought_by", null); // Only include items that are unsold (bought_by is null)

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

// Customer Liked-Items: Retrieve liked items
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

    // Modify the status of withdrawn items to "withdrawn by seller"
    const updatedOwnUploads = ownUploads.map((upload) => {
      if (upload.admin_status === "withdrawn") {
        return { ...upload, admin_status: "withdrawn by seller" };
      }
      return upload;
    });

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

      // Modify the status of withdrawn liked uploads to "withdrawn by seller"
      const updatedLikedUploads = likedUploads.map((upload) => {
        if (upload.admin_status === "withdrawn") {
          return { ...upload, admin_status: "withdrawn by seller" };
        }
        return upload;
      });

      // Mark sold items and whether the user bought them
      const finalLikedUploads = updatedLikedUploads.map((upload) => ({
        ...upload,
        isSold: upload.bought_by ? true : false, // Flag if the item is sold
        isBoughtByUser: upload.bought_by === user_id, // Check if this item was bought by the current user
      }));

      return res.status(200).json({
        ownUploads: updatedOwnUploads,
        likedUploads: finalLikedUploads,
      });
    }

    res.status(200).json({ ownUploads: updatedOwnUploads });
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

// Marketplace: Mark an item as sold and update bought_by with the buyer's UUID
router.put("/:uploadId/buy", authenticateToken, async (req, res) => {
  const { uploadId } = req.params;
  const { buyer_uuid } = req.body; // buyer_uuid is now passed in the request body

  if (!buyer_uuid) {
    return res.status(400).json({ message: "Buyer UUID is required." });
  }

  try {
    // Fetch the current item details to check if it's already bought and also get the uploader's user_id
    const { data: item, error: fetchError } = await supabase
      .from("uploads")
      .select("bought_by, user_id") // Fetch both the bought_by and user_id of the uploader
      .eq("upload_id", uploadId)
      .single();

    if (fetchError) {
      console.error("Error fetching item:", fetchError);
      return res
        .status(500)
        .json({ message: "Failed to fetch item.", error: fetchError });
    }

    console.log("Item Data:", item); // Debugging log to see the item data

    // Check if the logged-in user is the same as the uploader
    if (item.user_id === req.user.user_id) {
      console.log("User is trying to buy their own item"); // Debugging log
      return res.status(400).json({ message: "You cannot buy your own item." });
    }

    // If bought_by already has a value, the item has already been purchased
    if (item.bought_by) {
      return res
        .status(400)
        .json({ message: "This item has already been bought." });
    }

    // Update the bought_by column with the buyer's UUID and set the bought_at timestamp
    const { error: updateError } = await supabase
      .from("uploads")
      .update({
        bought_by: buyer_uuid,
        bought_at: new Date().toISOString(), // Set the bought_at timestamp
      })
      .eq("upload_id", uploadId);

    if (updateError) {
      console.error("Error updating item with buyer:", updateError);
      return res
        .status(500)
        .json({ message: "Failed to update item.", error: updateError });
    }

    res.status(200).json({ message: "Item bought successfully!" });
  } catch (error) {
    console.error("Error processing purchase:", error);
    return res
      .status(500)
      .json({ message: "Server error while processing purchase.", error });
  }
});

// Marketplace: Mark an item as un-bought (clear the bought_by field)
router.put("/:uploadId/unbuy", authenticateToken, async (req, res) => {
  const { uploadId } = req.params;

  try {
    // Fetch the current item to check if it has a buyer
    const { data: item, error: fetchError } = await supabase
      .from("uploads")
      .select("bought_by")
      .eq("upload_id", uploadId)
      .single();

    if (fetchError) {
      console.error("Error fetching item:", fetchError);
      return res
        .status(500)
        .json({ message: "Failed to fetch item", error: fetchError });
    }

    if (!item || !item.bought_by) {
      return res.status(400).json({ message: "This item hasn't been bought." });
    }

    // Clear the bought_by field to indicate the item is un-bought
    const { error: updateError } = await supabase
      .from("uploads")
      .update({ bought_by: null, bought_at: null }) // Clear bought_by and bought_at
      .eq("upload_id", uploadId);

    if (updateError) {
      console.error("Error updating item:", updateError);
      return res
        .status(500)
        .json({ message: "Failed to update item", error: updateError });
    }

    res.status(200).json({ message: "Item has been un-bought successfully." });
  } catch (error) {
    console.error("Error processing un-buy:", error);
    return res.status(500).json({
      message: "Server error while processing un-buy",
      error: error.message,
    });
  }
});

// Marketplace: Retrieve bought items for the authenticated user
router.get("/customer/bought", authenticateToken, async (req, res) => {
  const { user_id } = req.user;

  try {
    // Fetch items where the 'bought_by' field matches the logged-in user's ID
    const { data: boughtItems, error } = await supabase
      .from("uploads")
      .select("*")
      .eq("bought_by", user_id); // This checks if the user_id is in the 'bought_by' field

    if (error) {
      console.error("Error retrieving bought uploads:", error);
      return res.status(500).json({
        message: "Failed to retrieve bought uploads",
        error: error,
      });
    }

    if (!boughtItems.length) {
      return res.status(200).json({ message: "No bought items." });
    }

    res.status(200).json({ boughtItems });
  } catch (error) {
    console.error("Error retrieving bought items:", error);
    return res.status(500).json({ message: "Server error", error });
  }
});

export default router;
