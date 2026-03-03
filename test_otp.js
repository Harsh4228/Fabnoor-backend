/**
 * Direct OTP email test — bypasses the HTTP server entirely.
 * Run: node test_otp.js your@email.com
 * This sends a real OTP email to the given address.
 */
import "dotenv/config";
import { sendResetOtpEmail } from "./config/emailService.js";

const toEmail = process.argv[2];
if (!toEmail) {
    console.error("Usage: node test_otp.js <email>");
    process.exit(1);
}

const otp = Math.floor(100000 + Math.random() * 900000).toString();
console.log(`Sending OTP [${otp}] to: ${toEmail}`);

const result = await sendResetOtpEmail(toEmail, otp);
if (result) {
    console.log("✅ OTP email sent successfully! Check inbox and spam.");
} else {
    console.log("❌ OTP email FAILED. Check EMAIL_USER and EMAIL_PASS in .env");
}
