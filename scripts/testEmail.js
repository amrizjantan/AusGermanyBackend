import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "Zoho",
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
      console.log("Email sent:", info.response); // eslint-disable-line no-console
    }
  }
);
