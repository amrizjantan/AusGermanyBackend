const nodemailer = require("nodemailer");
require("dotenv").config(); // Ensure this line is included if using environment variables from .env file

const transporter = nodemailer.createTransport({
  service: "Zoho", // Ensure the email service matches your provider
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.sendMail(
  {
    to: "test@example.com",
    from: process.env.EMAIL_USER,
    subject: "Test Email",
    text: "This is a test email",
  },
  (err, info) => {
    if (err) {
      console.error("Email send error:", err);
    } else {
      console.log("Email sent:", info.response);
    }
  }
);
