import { Router } from "express";
import { check, validationResult } from "express-validator";
import { supabase } from "../index.js";
import authenticateToken from "../middleware/authenticateToken.js";

const router = Router();

// User send URL / make order request
router.post(
  "/",
  authenticateToken,
  [
    check("url", "URL is required").isURL(),
    check("title", "Title is required").notEmpty(),
    check("price", "Price must be a valid number").isFloat({ locale: "de-DE" }),
    check("description", "Description is required").notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let { url, title, price, description } = req.body;
    const { user_id } = req.user;

    try {
      price = parseFloat(price.replace(",", "."));

      const { data, error } = await supabase
        .from("orders")
        .insert([{ user_id, url, title, price, description }])
        .select();

      if (error?.code === "23505") {
        return res.status(400).json({
          message: "An order of yours with the same Item URL already exists.",
        });
      }

      if (error) {
        console.error("Error saving order:", error);
        return res.status(500).json({ message: "Failed to save order", error });
      }

      res
        .status(201)
        .json({ message: "Order saved successfully", order: data[0] });
    } catch (error) {
      console.error("Error saving order:", error);
      res.status(500).json({ message: "Server error", error });
    }
  }
);

// Retrieve Orders for Users "URL Card"
router.get("/", authenticateToken, async (req, res) => {
  const { user_id } = req.user;

  try {
    // Fetch orders for the authenticated user
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

// Admin Panel/Dashboard: Retrieve Orders
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

// Admin Panel/Dashboard: Review and send Offer to clients
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
        admin_status: "offer_sent", // Update admin status to reflect offer sent
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

// Admin Panel/Dashboard: Reject Order
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
    // Return a fixed message
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

export default router;
