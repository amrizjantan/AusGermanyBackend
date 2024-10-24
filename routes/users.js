import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { supabase } from "../index.js";

const router = Router();

router.post("/register", async (req, res) => {
  const {
    username,
    email,
    password,
    fullName,
    companyName,
    address,
    city,
    postalCode,
    state,
    isCompany,
    userType,
  } = req.body;

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ message: "Username, email, and password are required." });
  }

  // If userType is "both" (buyer and seller), validate the additional fields
  if (userType === "both") {
    if (!address || !city || !postalCode || !state) {
      return res.status(400).json({
        message:
          "Address, city, postal code, and state are required for sellers.",
      });
    }

    if (isCompany && !companyName) {
      return res
        .status(400)
        .json({ message: "Company name is required for companies." });
    }

    if (!isCompany && !fullName) {
      return res
        .status(400)
        .json({ message: "Full name is required for private individuals." });
    }
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const { error, data } = await supabase
      .from("users")
      .insert([
        {
          username,
          email,
          password: hashedPassword,
          full_name: fullName || null,
          company_name: companyName || null,
          address: address || null,
          city: city || null,
          postal_code: postalCode || null,
          state: state || null,
          is_company: isCompany || false,
          user_type: userType || "buyer",
        },
      ])
      .select("user_id");

    // Check for email duplication (Postgres error code 23505)
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
    console.error("Error registering user:", JSON.stringify(error.message));
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const { error, data } = await supabase
      .from("users")
      .select("user_id, username, password, user_type")
      .eq("email", email);

    if (error) {
      throw new Error(JSON.stringify(error));
    }

    if (!data[0]?.user_id) {
      console.error(error);
      return res.status(400).json({ message: "Invalid email" });
    }

    const {
      user_id,
      username,
      password: encryptedPassword,
      user_type,
    } = data[0];

    const isCorrectPassword = await bcrypt.compare(password, encryptedPassword);
    if (!isCorrectPassword) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { user_id, username, user_type },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );

    res.status(200).json({
      user_id,
      username,
      user_type,
      token,
      message: "Logged in successfully",
    });
  } catch (error) {
    console.error("Login error:", JSON.stringify(error.message));
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
