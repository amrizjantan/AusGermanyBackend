import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { supabase } from "../index.js";

const router = Router();

router.post("/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    const { error, data } = await supabase
      .from("users")
      .insert([{ email, password: await bcrypt.hash(password, 10) }])
      .select("user_id");

    if (error?.code === "23505") {
      return res.status(400).json({ message: "Email already exists." });
    }

    if (error) {
      throw new Error(JSON.stringify(error));
    }

    const { user_id } = data[0];

    const token = jwt.sign({ user_id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(201).json({ message: "User registered successfully", token });
  } catch (error) {
    console.error("Error registering admin:", error);
    res.status(500).json({ message: "Server error", error });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const { error, data } = await supabase
      .from("admin")
      .select("user_id, password")
      .eq("email", email);

    if (error) {
      throw new Error(JSON.stringify(error));
    }

    if (!data[0]?.user_id) {
      console.error(error);
      return res.status(400).json({ message: "Invalid email" });
    }

    const { user_id, password: encryptedPassword } = data[0];

    const isCorrectPassword = await bcrypt.compare(password, encryptedPassword);
    if (!isCorrectPassword) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign({ user_id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(200).json({
      message: "Logged in successfully",
      token,
    });
  } catch (error) {
    console.error("Login error:", JSON.stringify(error.message));
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
