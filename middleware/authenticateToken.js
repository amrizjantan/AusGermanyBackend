// middleware/authenticateToken.js
import jwt from "jsonwebtoken";

const authenticateToken = (req, res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader) {
    return res
      .status(401)
      .json({ message: "Access Denied. No token provided." });
  }

  const token = authHeader.replace("Bearer ", "");

  if (!token) {
    return res
      .status(401)
      .json({ message: "Access Denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(400).json({ message: "Invalid token." });
  }
};

export default authenticateToken; // Ensure you're using this line to export
