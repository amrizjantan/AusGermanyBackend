import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { supabase } from "../index.js";

const router = Router();

router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const { error } = await supabase
      .from("users")
      .insert([{ username, email, password: await bcrypt.hash(password, 10) }])
      .select();

    if (error?.code === "23505") {
      return res.status(400).json({ message: "Email already exists." });
    }

    if (error) {
      throw new Error(error);
    }

    const token = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(201).json({ message: "User registered successfully", token });
  } catch (err) {
    console.error("Error registering user:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data, error } = await supabase
      .from("users")
      .select()
      .eq("email", email);

    if (error || !data.length) {
      console.error(error);
      return res.status(400).json({ message: "Invalid email" });
    }

    const isCorrectPassword = await bcrypt.compare(password, data[0].password);
    if (!isCorrectPassword) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(200).json({
      username: data[0].username,
      message: "Logged in successfully",
      token,
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
