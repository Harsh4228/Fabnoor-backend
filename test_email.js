/**
 * Quick script to test Gmail SMTP credentials.
 * Run: node test_email.js
 * If it prints "✅  Test email sent!" the credentials work.
 */
import nodemailer from "nodemailer";
import "dotenv/config";

const user = process.env.EMAIL_USER;
const pass = process.env.EMAIL_PASS;

console.log("Testing email with:", user);

if (!user || !pass) {
    console.error("❌  EMAIL_USER or EMAIL_PASS not set in .env");
    process.exit(1);
}

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
});

try {
    await transporter.sendMail({
        from: `"Fabnoor Test" <${user}>`,
        to: user,       // sends to itself so you can verify
        subject: "✅ Fabnoor OTP Email Test",
        text: "If you see this, Gmail SMTP is working correctly!",
    });
    console.log("✅  Test email sent! Check your inbox (and spam folder).");
} catch (err) {
    console.error("❌  FAILED:", err.message);
    if (err.responseCode) console.error("   SMTP code:", err.responseCode);
    if (err.response) console.error("   SMTP msg :", err.response);
}
