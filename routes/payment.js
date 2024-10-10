import { Router } from "express";
import Stripe from "stripe";
import { supabase } from "../index.js";
import authenticateToken from "../middleware/authenticateToken.js";

const router = Router();

export const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

router.post("/:order_id", authenticateToken, async (req, res) => {
  const { order_id } = req.params;

  try {
    const { error, data } = await supabase
      .from("users")
      .select("user_id, username, password")
      .eq("order_id", order_id);

    if (error) {
      throw new Error(JSON.stringify(error));
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: data[0].amount,
      currency: "eur",
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
      // [DEV]: For demo purposes only, you should avoid exposing the PaymentIntent ID in the client-side code.
      dpmCheckerLink: `https://dashboard.stripe.com/settings/payment_methods/review?transaction_id=${paymentIntent.id}`,
    });
  } catch (error) {
    console.error("Error creating checkout:", error);
    res.status(500).json({ message: "Server error", error });
  }
});

export default router;
