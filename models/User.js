const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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
    match: [/.+\@.+\..+/, "Please fill a valid email address"], // Simple email validation
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  urls: [String], // Optional field for storing URLs
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

module.exports = mongoose.model("User", UserSchema);

// const mongoose = require("mongoose");
// const bcrypt = require("bcryptjs");

// // Define a sub-schema for the scraped data
// const ScrapedDataSchema = new mongoose.Schema({
//   url: {
//     type: String,
//     required: true,
//   },
//   title: {
//     type: String,
//     required: true,
//   },
//   price: {
//     type: String,
//     required: true,
//   },
//   imageUrl: {
//     type: String,
//     required: true,
//   },
//   scrapedAt: {
//     type: Date,
//     default: Date.now, // Automatically store when the data was scraped
//   },
// });

// // Define the main User schema
// const UserSchema = new mongoose.Schema({
//   username: {
//     type: String,
//     required: true,
//     unique: true,
//     minlength: 3,
//   },
//   email: {
//     type: String,
//     required: true,
//     unique: true,
//     match: [/.+\@.+\..+/, "Please fill a valid email address"], // Simple email validation
//   },
//   password: {
//     type: String,
//     required: true,
//     minlength: 6,
//   },
//   // Store scraped data as an array of sub-documents
//   urls: [ScrapedDataSchema],
// });

// // Hash the password before saving the user
// UserSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) {
//     return next();
//   }
//   try {
//     const salt = await bcrypt.genSalt(10);
//     this.password = await bcrypt.hash(this.password, salt);
//     next();
//   } catch (err) {
//     return next(err);
//   }
// });

// // Method to compare passwords
// UserSchema.methods.comparePassword = async function (candidatePassword) {
//   return bcrypt.compare(candidatePassword, this.password);
// };

// module.exports = mongoose.model("User", UserSchema);
