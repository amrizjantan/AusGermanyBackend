// middleware/authorizeUserType.js

const authorizeUserType = (allowedTypes) => {
  return (req, res, next) => {
    const userType = req.user?.user_type; // Get user type from request
    console.log("User type:", userType); // Log user type

    if (!userType || !allowedTypes.includes(userType)) {
      return res
        .status(403)
        .json({ message: "Access denied: user type not allowed" });
    }

    next(); // User type is allowed, continue to the next middleware or route handler
  };
};

export default authorizeUserType;
