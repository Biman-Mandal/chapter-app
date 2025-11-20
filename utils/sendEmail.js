const nodemailer = require("nodemailer");

exports.sendEmail = async (to, subject, html) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVICE,   // sandbox.smtp.mailtrap.io
    port: process.env.EMAIL_PORT,                         // Mailtrap TLS port
    secure: false,                     // must be false for port 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,       // important for local SSL issues
    },
  });

  await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};
