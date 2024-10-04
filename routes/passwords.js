import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { supabase } from "../index.js";

const router = Router();

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const { error, data } = await supabase
      .from("users")
      .select("user_id")
      .eq("email", email);

    if (error) {
      throw new Error(JSON.stringify(error));
    }

    if (!data[0]) {
      return res.status(400).json({ message: "User not found." });
    }

    const resetPasswordToken = crypto.randomBytes(20).toString("hex");
    const resetPasswordExpirationTimestamp = Date.now() + 3600000; // 1 hour in milliseconds from now (UTC)

    const { error: updateError } = await supabase
      .from("users")
      .update({
        reset_password_token: resetPasswordToken,
        reset_password_expiration_timestamp: resetPasswordExpirationTimestamp,
      })
      .eq("email", email);

    if (updateError) {
      throw new Error(JSON.stringify(updateError));
    }

    const transporter = nodemailer.createTransport({
      service: "Zoho",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const resetUrl = `${req.protocol}://${req
      .get("host")
      .replace(":5001", ":5173")}/resetpassword/${resetPasswordToken}`;

    await transporter.sendMail({
      to: email,
      from: process.env.EMAIL_USER,
      subject: "Password Reset Request",
      html: `
        <p>You are receiving this email because you (or someone else) have requested to reset the password for your account.</p>
        <p>Please click on the following link, or paste it into your browser to complete the process:</p>
        <p><a href="${resetUrl}" target="_blank">${resetUrl}</a></p>
        <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
        <p>Best regards,<br>Your Company</p>
      `,
    });

    res.status(200).json({ message: "Password reset email sent" });
  } catch (error) {
    console.error("Forgot password error:", JSON.stringify(error.message));
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const { error, data } = await supabase
      .from("users")
      .select()
      .eq("reset_password_token", token)
      .gt("reset_password_expiration_timestamp", Date.now());

    if (error) {
      throw new Error(JSON.stringify(error));
    }

    if (!data[0]) {
      return res
        .status(400)
        .json({ message: "Password reset token is invalid or has expired" });
    }

    const { email } = data[0];

    if (!email) {
      return res.status(400).json({ message: "User not found." });
    }

    const { error: updateError, data: updateData } = await supabase
      .from("users")
      .update({
        password: await bcrypt.hash(password, 10),
        reset_password_token: null,
        reset_password_expiration_timestamp: null,
      })
      .select()
      .eq("email", email);

    if (updateError) {
      throw new Error(JSON.stringify(updateError));
    }

    if (!updateData[0]) {
      throw new Error("Could not find email address corresponding to token.");
    }

    res.status(201).json({ message: "Password has been reset successfully" });
  } catch (error) {
    console.error("Reset password error:", JSON.stringify(error.message));
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
