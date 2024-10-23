import { Router } from "express";
import Stripe from "stripe";
import { supabase } from "../index.js";
import authenticateToken from "../middleware/authenticateToken.js";

const router = Router();

export const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

router.post("/:order_id", authenticateToken, async (req, res) => {
  const { order_id } = req.params;
  const { user_id } = req.body;

  try {
    const { error, data } = await supabase
      .from("orders")
      .select("price, title, users(email)")
      .match({ order_id, user_id })
      .single();

    if (error || !data) {
      throw new Error(`Error finding order: ${JSON.stringify(error)}`);
    }

    const totalAmount = Number(data.price) * 100;

    if (!totalAmount) {
      throw new Error(`Error calculating price.`);
    }

    // Create new Checkout Session for the order
    // Other optional params include:
    // For full details see https://stripe.com/docs/api/checkout/sessions/create
    const { url } = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: data.email,
      line_items: [
        {
          price_data: {
            unit_amount: totalAmount,
            currency: "eur",
            product_data: {
              name: data.title,
            },
          },
          quantity: 1,
        },
      ],
      // ?session_id={CHECKOUT_SESSION_ID} means the redirect will have the session ID set as a query param
      success_url:
        "http://localhost:5173/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "http://localhost:5173/canceled",
      automatic_tax: { enabled: true },
    });

    return res.status(303).json({ url });
  } catch (error) {
    console.error("Error creating checkout:", error);
    res.status(500).json({ message: "Server error", error });
  }
});

// Fetch the Checkout Session to display the JSON result on the success page
router.get("/checkout-session", async (req, res) => {
  const { sessionId } = req.query;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  res.send(session);
});

// Webhook handler for asynchronous events.
router.post("/webhook", async (req, res) => {
  let event;

  // Check if webhook signing is configured.
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let signature = req.headers["stripe-signature"];

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch {
      console.log(`⚠️  Webhook signature verification failed.`); // eslint-disable-line no-console
      return res.sendStatus(400);
    }
  } else {
    // Webhook signing is recommended, but if the secret is not configured in `.env`,
    // retrieve the event data directly from the request body.
    event = req.body;
  }

  if (event.type === "checkout.session.completed") {
    console.log(`🔔  Payment received!`); // eslint-disable-line no-console

    // Note: If you need access to the line items, for instance to
    // automate fullfillment based on the the ID of the Price, you'll
    // need to refetch the Checkout Session here, and expand the line items:
    //
    // const session = await stripe.checkout.sessions.retrieve(
    //   'cs_test_KdjLtDPfAjT1gq374DMZ3rHmZ9OoSlGRhyz8yTypH76KpN4JXkQpD2G0',
    //   {
    //     expand: ['line_items'],
    //   }
    // );
    //
    // const lineItems = session.line_items;
  }

  res.sendStatus(200);
});

export default router;
