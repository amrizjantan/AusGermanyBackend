import { Router } from "express";
import { check, validationResult } from "express-validator";
import { supabase } from "../index.js";
import authenticateToken from "../middleware/authenticateToken.js";

const router = Router();

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

// Update Order
router.put("/:id/update", authenticateToken, async (req, res) => {
  const { id } = req.params; // Extract order ID from URL
  const { postal_fee, service_fee, price, title, description, platform } =
    req.body;

  try {
    // update the order
    const { data, error } = await supabase
      .from("orders")
      .update({
        postal_fee,
        service_fee,
        price,
        title,
        description,
        platform,
      })
      .eq("order_id", id) // 'id' is the primary key
      .select();

    if (error) {
      console.error("Error updating order:", error);
      return res.status(500).json({ message: "Failed to update order", error });
    }

    if (data.length === 0) {
      return res
        .status(404)
        .json({ message: "Order not found or no changes made." });
    }

    res
      .status(200)
      .json({ message: "Order updated successfully.", order: data[0] });
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ message: "Server error." });
  }
});

export default router;
