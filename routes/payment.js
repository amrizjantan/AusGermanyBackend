import { Router } from "express";
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

    // Debug: log the incoming payload
    console.log("Payload for checkout:", req.body);

    // Array to hold the Stripe line items
    const line_items = [];

    // Process each item from the payload
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

      // Calculate total amount in cents. Total Amount= price + postal_fee + service_fee
      const price = Number(itemData.price) || 0;
      const postal_fee = Number(itemData.postal_fee) || 0;
      const service_fee = Number(itemData.service_fee) || 0;
      const totalAmountCents = (price + postal_fee + service_fee) * 100;

      console.log(
        `Calculated total amount for item ${item.item_id}: ${totalAmountCents} cents`
      );

      // Create a line item for Stripe.
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

    // Retrieve email from request body
    let customer_email = req.body.email; // Use directly from payload

    // If for some reason it's missing, default to a placeholder
    if (!customer_email) {
      customer_email = "fallback@example.com"; // Change this if necessary
    }

    console.log("Final customer email:", customer_email);

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
    // Fallback if no email was retrieved (in production, fetch from the users table)
    if (!customer_email) {
      customer_email = "example@example.com";
    }

    console.log(
      "Creating Stripe Checkout session with line items:",
      line_items
    );
    console.log("Customer email:", customer_email);

    // Create a Stripe Checkout session with the line items.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customer_email,
      line_items,
      success_url:
        "http://localhost:5173/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "http://localhost:5173/canceled",
      automatic_tax: { enabled: true },
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
router.post("/webhook", async (req, res) => {
  let event;

  if (process.env.STRIPE_WEBHOOK_SECRET) {
    let signature = req.headers["stripe-signature"];
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("⚠️  Webhook signature verification failed.", err);
      return res.sendStatus(400);
    }
  } else {
    event = req.body;
  }

  if (event.type === "checkout.session.completed") {
    console.log("🔔  Payment received for session:", event.data.object.id);
    // Additional fulfillment logic can go here.
  }

  res.sendStatus(200);
});

export default router;
