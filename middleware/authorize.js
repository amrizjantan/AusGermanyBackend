const authorize = (roles) => {
  return (req, res, next) => {
    const userRole = req.user.role; // Assume role is stored in user JWT
    if (!roles.includes(userRole)) {
      return res.status(403).json({ message: "Forbidden: Access is denied." }); // Forbidden
    }
    next();
  };
};

export default authorize;
