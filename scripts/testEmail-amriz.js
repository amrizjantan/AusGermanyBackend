const nodemailer = require("nodemailer");
require("dotenv").config(); // Ensure this line is included if using environment variables from .env file

const transporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 465, // or 587 if using TLS
  secure: true, // true for port 465, false for port 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const mailOptions = {
  from: process.env.EMAIL_USER,
  to: "amrizjantan@gmail.com", // Ensure this is the correct recipient
  subject: "Test Email",
  text: "This is a test email",
};

transporter.sendMail(mailOptions, (err, info) => {
  if (err) {
    console.error("Email send error:", err);
    if (err.response) {
      console.error("SMTP Response:", err.response);
    }
  } else {
    console.log("Email sent:", info.response);
  }
});
