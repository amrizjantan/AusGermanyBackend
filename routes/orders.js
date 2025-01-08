import { Router } from "express";
import { check, validationResult } from "express-validator";
import { supabase } from "../index.js";
import authenticateToken from "../middleware/authenticateToken.js";

const router = Router();

// Customer sends order request
router.post(
  "/",
  authenticateToken,
  [
    check("url", "URL is required").isURL(),
    check("description").optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { url, title, description } = req.body;
    const { user_id } = req.user;

    try {
      const { data, error } = await supabase
        .from("orders")
        .insert([
          {
            user_id,
            url,
            title: title || null,
            description: description || null,
          },
        ])
        .select();

      if (error) {
        console.error("Error saving order:", error);
        return res.status(500).json({ message: "Failed to save order", error });
      }

      res.status(201).json({
        message: "Order saved successfully",
        order: data[0],
      });
    } catch (error) {
      console.error("Error saving order:", error);
      res.status(500).json({ message: "Server error", error });
    }
  }
);

// Retrieve order request for Customers "URL Card"
router.get("/", authenticateToken, async (req, res) => {
  const { user_id } = req.user;

  try {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user_id); // Filter by user_id

    if (error) {
      console.error("Error retrieving orders:", error);
      return res
        .status(500)
        .json({ message: "Failed to retrieve orders", error });
    }

    res.status(200).json({ orders });
  } catch (error) {
    console.error("Error retrieving orders:", error);
    res.status(500).json({ message: "Server error", error });
  }
});

// Admin Dashboard: Retrieve order request
router.get("/admin/orders", authenticateToken, async (req, res) => {
  try {
    // Join orders with users to get username and email
    const { data: orders, error } = await supabase.from("orders").select(`
        *,
        users(username, email)
      `);

    if (error) {
      console.error("Error retrieving orders:", error);
      return res
        .status(500)
        .json({ message: "Failed to retrieve orders", error });
    }

    // Return the orders with associated user details
    res.status(200).json({ orders });
  } catch (error) {
    console.error("Error retrieving orders:", error);
    res.status(500).json({ message: "Server error", error });
  }
});

// Admin Dashboard: Review and send offer (approved order request) to customers
router.put("/:id/offer", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const {
    postal_fee,
    service_fee,
    price,
    title,
    description,
    platform,
    total_amount,
  } = req.body;

  try {
    // Update the order with the new details and mark as 'offer_sent'
    const { data, error } = await supabase
      .from("orders")
      .update({
        postal_fee,
        service_fee,
        price,
        title,
        description,
        platform,
        total_amount,
        admin_status: "offer_sent",
      })
      .eq("order_id", id)
      .select();

    if (error) {
      console.error("Error sending offer:", error);
      return res.status(500).json({ message: "Failed to send offer", error });
    }

    if (data.length === 0) {
      return res
        .status(404)
        .json({ message: "Order not found or no changes made." });
    }
    res
      .status(200)
      .json({ message: "Offer sent successfully.", order: data[0] });
  } catch (error) {
    console.error("Send offer error:", error);
    res.status(500).json({ message: "Server error." });
  }
});

// Admin Dashboard: Reject order request
router.put("/:id/reject", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from("orders")
      .update({ admin_status: "rejected" })
      .eq("order_id", id)
      .select();

    if (error) {
      console.error("Error rejecting order:", error);
      return res.status(500).json({ message: "Failed to reject order", error });
    }

    if (data.length === 0) {
      return res.status(404).json({ message: "Order not found." });
    }
    res.status(200).json({
      message:
        "Order rejected successfully. Item is no longer available or we can propose such a request.",
      order: data[0],
    });
  } catch (error) {
    console.error("Reject error:", error);
    res.status(500).json({ message: "Server error." });
  }
});

// Customer accepts the offer (approved order request) from Admin
router.put("/:id/accept", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from("orders")
      .update({
        offer_status: "accepted",
        offer_response_at: new Date(),
      })
      .eq("order_id", id)
      .select();

    if (error) {
      console.error("Error accepting offer:", error);
      return res.status(500).json({ message: "Failed to accept offer", error });
    }

    if (data.length === 0) {
      return res.status(404).json({ message: "Order not found." });
    }

    res.status(200).json({ message: "Offer accepted.", order: data[0] });
  } catch (error) {
    console.error("Accept offer error:", error);
    res.status(500).json({ message: "Server error." });
  }
});

// Customer declines the offer (approved order request) from Admin
router.put("/:id/decline", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from("orders")
      .update({
        offer_status: "declined", // Updated status for declining offer
        offer_response_at: new Date(),
      })
      .eq("order_id", id)
      .select();

    if (error) {
      console.error("Error declining offer:", error);
      return res
        .status(500)
        .json({ message: "Failed to decline offer", error });
    }

    if (data.length === 0) {
      return res.status(404).json({ message: "Order not found." });
    }

    res.status(200).json({ message: "Offer declined.", order: data[0] });
  } catch (error) {
    console.error("Decline offer error:", error);
    res.status(500).json({ message: "Server error." });
  }
});

export default router;
