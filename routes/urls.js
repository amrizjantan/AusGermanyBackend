import { Router } from "express";
import { check, validationResult } from "express-validator";
import { supabase } from "../index.js";
import authenticateToken from "../middleware/authenticateToken.js";

const router = Router();

// Save URL and Order
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
      const { error } = await supabase
        .from("orders")
        .insert([
          { user_id, url, title, price: parseFloat(price), description },
        ]); // Ensure price is a float

      if (error) {
        console.error("Error saving order:", error); // Log the error
        return res.status(500).json({ message: "Failed to save order", error });
      }

      res.status(201).json({ message: "Order saved successfully" }); // Respond with success message
    } catch (error) {
      console.error("Error saving order:", error); // Log unexpected errors
      res.status(500).json({ message: "Server error", error });
    }
  }
);

export default router;
