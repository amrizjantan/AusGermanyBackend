import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    minlength: 3,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/.+@.+\..+/, "Please fill a valid email address"], // Simple email validation
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  resetpasswordtoken: String,
  resetPasswordExpires: Date,
  urls: [
    {
      // Define urls as an array of objects
      url: String,
      title: String,
      price: String,
      imageUrl: String,
    },
  ],
});

// Hash the password before saving the user
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    return next(err);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("User", UserSchema);
