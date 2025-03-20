import { Router } from "express";
import express from "express";
import Stripe from "stripe";
import { supabase } from "../index.js";
import authenticateToken from "../middleware/authenticateToken.js";

const router = Router();
export const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

router.post("/checkout", authenticateToken, async (req, res) => {
  const { user_id, items } = req.body; // Expected payload: { user_id: string, items: [{ item_id, amount }, ...] }

  try {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error("No items provided for checkout.");
    }

    console.log("Payload for checkout:", req.body);
    const line_items = [];

    for (const item of items) {
      let itemData = null;
      console.log(`Processing item with id: ${item.item_id}`);

      // Try to fetch the item from the 'uploads' table first.
      const { data: uploadData, error: uploadError } = await supabase
        .from("uploads")
        .select("price, title, postal_fee, service_fee, images")
        .eq("upload_id", item.item_id)
        .maybeSingle();

      if (!uploadError && uploadData) {
        console.log(`Found item in uploads:`, uploadData);
        itemData = uploadData;
      } else {
        // If not found in uploads, try the orders table.
        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select("price, title, postal_fee, service_fee, users(email)")
          .match({ order_id: item.item_id, user_id })
          .single();

        console.log(`Lookup in orders for item_id ${item.item_id}:`, {
          orderData,
          orderError,
        });
        if (orderError || !orderData) {
          throw new Error(
            `Error fetching order data for ${item.item_id}: ${JSON.stringify(orderError)}`
          );
        }
        itemData = orderData;
      }

      // Calculate total amount in cents.
      const price = Number(itemData.price) || 0;
      const postal_fee = Number(itemData.postal_fee) || 0;
      const service_fee = Number(itemData.service_fee) || 0;
      const totalAmountCents = (price + postal_fee + service_fee) * 100;

      console.log(
        `Calculated total amount for item ${item.item_id}: ${totalAmountCents} cents`
      );

      // Create a Stripe line item.
      line_items.push({
        price_data: {
          unit_amount: totalAmountCents,
          currency: "eur",
          product_data: {
            name: itemData.title,
          },
        },
        quantity: 1,
      });
    }

    if (line_items.length === 0) {
      throw new Error("No valid items found for checkout.");
    }

    let customer_email = req.body.email || "fallback@example.com";
    const orderItem = items.find((i) => !i.item_id.startsWith("upload"));
    if (orderItem) {
      const { data: orderEmailData, error: orderEmailError } = await supabase
        .from("orders")
        .select("users(email)")
        .match({ order_id: orderItem.item_id, user_id })
        .single();
      if (!orderEmailError && orderEmailData && orderEmailData.users) {
        customer_email = orderEmailData.users.email;
      }
    }
    if (!customer_email) {
      customer_email = "example@example.com";
    }

    console.log(
      "Creating Stripe Checkout session with line items:",
      line_items
    );
    console.log("Customer email:", customer_email);

    // Create the Stripe Checkout session with metadata.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customer_email,
      line_items,
      success_url:
        "http://localhost:5173/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "http://localhost:5173/canceled",
      automatic_tax: { enabled: true },
      // Pass the items and user_id in metadata as JSON strings.
      metadata: {
        items: JSON.stringify(items),
        user_id,
      },
    });

    console.log("Stripe session created:", session);
    return res.status(303).json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
});

// Fetch the Checkout Session to display the JSON result on the success page
router.get("/checkout-session", async (req, res) => {
  const { sessionId } = req.query;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    res.send(session);
  } catch (error) {
    console.error("Error retrieving checkout session:", error);
    res
      .status(500)
      .send({ message: "Error retrieving session", error: error.message });
  }
});

// Webhook handler for asynchronous events.
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let event;

    // [Keep existing signature verification code...]

    console.log("Received webhook event:", event);

    if (event.type === "checkout.session.completed") {
      const sessionObj = event.data.object;
      const metadata = sessionObj.metadata;

      // Validate metadata
      if (!metadata?.items || !metadata.user_id) {
        console.error("Missing metadata");
        return res.status(400).send("Bad Request");
      }

      // Parse items
      let items;
      try {
        items = JSON.parse(metadata.items);
        if (!Array.isArray(items)) throw new Error("Invalid items format");
      } catch (err) {
        console.error("Failed to parse items:", err);
        return res.status(400).send("Invalid items format");
      }

      const user_id = metadata.user_id;
      console.log("Processing items:", items);

      try {
        for (const item of items) {
          const table = item.type === "upload" ? "uploads" : "orders";
          const column = item.type === "upload" ? "upload_id" : "order_id";

          console.log(`Updating ${table} ${item.item_id}...`);

          // For orders, ensure the record exists
          if (table === "orders") {
            const { data: existingOrder, error: fetchError } = await supabase
              .from("orders")
              .select("*")
              .eq("order_id", item.item_id)
              .single();

            if (fetchError || !existingOrder) {
              console.error(`Order ${item.item_id} not found. Skipping...`);
              continue;
            }
          }

          // Update the table
          const { data, error } = await supabase
            .from(table)
            .update({ paid: true })
            .eq(column, item.item_id)
            .select();

          if (error) {
            console.error(`Error updating ${table} ${item.item_id}:`, error);
          } else {
            console.log(`Successfully updated ${table}:`, data);
          }
        }

        res.sendStatus(200);
      } catch (err) {
        console.error("Payment update failed:", err);
        res.status(500).send("Internal Server Error");
      }
    } else {
      res.sendStatus(200);
    }
  }
);

export default router;
