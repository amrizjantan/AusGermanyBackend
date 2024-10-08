// backend/routes/admin.js
import bcrypt from "bcrypt"; // Import bcrypt for password hashing
import { Router } from "express";
import { supabase } from "../index.js";
import jwt from "jsonwebtoken"; // Import jsonwebtoken

const router = Router();

// Route to register a new admin
router.post("/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if an admin already exists with the given email
    const { data: existingAdmin, error: findError } = await supabase
      .from("admins")
      .select("id")
      .eq("email", email)
      .single();

    if (existingAdmin) {
      return res
        .status(400)
        .json({ message: "Admin with this email already exists." });
    }

    if (findError && findError.code !== "PGRST116") {
      return res.status(500).json({
        message: "Failed to check for existing admin",
        error: findError,
      });
    }

    // Hash the password before saving to the database
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new admin into the 'admins' table
    const { data: admin, error: insertError } = await supabase
      .from("admins")
      .insert([{ email, password: hashedPassword }])
      .select();

    if (insertError) {
      return res
        .status(500)
        .json({ message: "Failed to register admin", error: insertError });
    }

    res.status(201).json({ message: "Admin registered successfully", admin });
  } catch (error) {
    console.error("Error registering admin:", error);
    res.status(500).json({ message: "Server error", error });
  }
});

// Route to handle admin login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find the admin in the database
    const { data: admin, error: adminError } = await supabase
      .from("admins") // Ensure you have the correct table name
      .select("*")
      .eq("email", email)
      .single(); // Fetch a single record

    if (adminError || !admin) {
      return res.status(400).json({ message: "Admin not found." });
    }

    // Verify the password
    const passwordMatch = await bcrypt.compare(password, admin.password); // Assuming the password is hashed
    if (!passwordMatch) {
      return res.status(400).json({ message: "Invalid password." });
    }

    // Generate a token (assuming you have a function to create JWT tokens)
    const token = jwt.sign(
      { id: admin.id, email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({ token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error." });
  }
});

export default router;
