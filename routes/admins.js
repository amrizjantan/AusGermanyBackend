import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { supabase } from "../index.js";

const router = Router();

router.post("/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    const { error, data } = await supabase
      .from("admins")
      .insert([{ email, password: await bcrypt.hash(password, 10) }])
      .select("admin_id");

    if (error?.code === "23505") {
      return res.status(400).json({ message: "Email already exists." });
    }

    if (error) {
      throw new Error(JSON.stringify(error));
    }

    const { admin_id } = data[0];
    const token = jwt.sign({ admin_id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(201).json({ message: "User registered successfully", token });
  } catch (error) {
    console.error("Error registering admin:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const { error, data } = await supabase
      .from("admins")
      .select("admin_id, password")
      .eq("email", email);

    if (error) {
      throw new Error(JSON.stringify(error));
    }

    if (!data[0]?.admin_id) {
      return res.status(400).json({ message: "Invalid email" });
    }

    const { admin_id, password: encryptedPassword } = data[0];

    const isCorrectPassword = await bcrypt.compare(password, encryptedPassword);
    if (!isCorrectPassword) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign({ admin_id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Include the email in the response
    res.status(200).json({ message: "Logged in successfully", email, token });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;
