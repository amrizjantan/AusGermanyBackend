import { Router } from "express";
import { check, validationResult } from "express-validator";
import { supabase } from "../index.js";
import authenticateToken from "../middleware/authenticateToken.js";

const router = Router();

router.post(
  "/save-order",
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

      // Check if an order with the same URL already exists for this user
      const { data: existingOrder, error: checkError } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user_id) // Filter by user
        .eq("url", url); // Filter by URL

      if (checkError) {
        console.error("Error checking existing order:", checkError);
        return res
          .status(500)
          .json({ message: "Server error", error: checkError });
      }

      if (existingOrder.length > 0) {
        // If an order with the same URL already exists, return an error
        return res
          .status(400)
          .json({ message: "Order with the same URL already exists" });
      }

      // If no existing order, insert the new order
      const { data, error } = await supabase
        .from("orders")
        .insert([{ user_id, url, title, price, description }])
        .select();

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

// Retrieve Orders
router.get("/list-orders", authenticateToken, async (req, res) => {
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

export default router;
