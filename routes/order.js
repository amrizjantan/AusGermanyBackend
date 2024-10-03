import { Router } from "express";
import { check, validationResult } from "express-validator";
import { supabase } from "../index.js";
import authenticateToken from "../middleware/authenticateToken.js";

const router = Router();

// Save Order
router.post(
  "/save-order",
  authenticateToken,
  [
    check("url", "URL is required").isURL(), // Validate that the URL is a valid format
    check("title", "Title is required").notEmpty(), // Ensure the title is provided
    check("price", "Price must be a valid number").isNumeric(), // Validate price as a number
    check("description", "Description is required").notEmpty(), // Ensure description is provided
  ],
  async (req, res) => {
    const errors = validationResult(req); // Collect validation errors
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() }); // Return errors if any
    }

    const { url, title, price, description } = req.body; // Extract form data
    const { user_id } = req.user; // Get user_id from the authenticated token

    try {
      // Insert the order into the orders table
      const { data, error } = await supabase
        .from("orders")
        .insert([
          { user_id, url, title, price: parseFloat(price), description },
        ])
        .select(); // Get the inserted data, including the order_id

      if (error) {
        console.error("Error saving order:", error); // Log the error
        return res.status(500).json({ message: "Failed to save order", error });
      }

      res
        .status(201)
        .json({ message: "Order saved successfully", order: data[0] }); // Respond with success message and the order details
    } catch (error) {
      console.error("Error saving order:", error); // Log unexpected errors
      res.status(500).json({ message: "Server error", error });
    }
  }
);

// Retrieve Orders
router.get("/list-orders", authenticateToken, async (req, res) => {
  const { user_id } = req.user; // Get user_id from the authenticated token

  try {
    // Fetch orders for the authenticated user
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*") // Select all fields including the ID
      .eq("user_id", user_id); // Filter by user_id

    if (error) {
      console.error("Error retrieving orders:", error);
      return res
        .status(500)
        .json({ message: "Failed to retrieve orders", error });
    }

    res.status(200).json({ orders }); // Return orders which should include order ID
  } catch (error) {
    console.error("Error retrieving orders:", error);
    res.status(500).json({ message: "Server error", error });
  }
});

export default router;
