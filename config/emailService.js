import nodemailer from "nodemailer";

/**
 * Creates a fresh transporter on every call so that:
 *  1. A changed Gmail App Password in .env is picked up without restart.
 *  2. Pool connections don't carry stale auth credentials.
 */
const createTransporter = () => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    console.warn("⚠️  EMAIL_USER or EMAIL_PASS not set — emails will NOT be sent.");
    return null;
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // SSL — more reliable than STARTTLS for Gmail App Passwords
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
};

/**
 * Internal helper: sends a mail and returns true/false.
 */
const sendMail = async (mailOptions) => {
  const transporter = createTransporter();
  if (!transporter) return false;

  try {
    const info = await transporter.sendMail(mailOptions);
    const accepted = info?.accepted ?? [];
    console.log("✅ Email sent to:", accepted.join(", ") || mailOptions.to);
    return true;
  } catch (err) {
    // Log the full error so it's visible in Render logs
    console.error("❌ Email send error:", err?.message ?? err);
    if (err?.responseCode) console.error("   SMTP response code:", err.responseCode);
    if (err?.response) console.error("   SMTP response msg :", err.response);
    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Order Confirmation Email
// ─────────────────────────────────────────────────────────────────────────────
export const sendOrderEmail = async (toEmail, items, amount) => {
  const itemList = (items || [])
    .map((item, i) => {
      const codeInfo = item?.code ? ` [Code: ${item.code}]` : "";
      return `${i + 1}. ${item?.name || "Item"}${codeInfo} (Qty: ${item?.quantity || 0}) - ₹${item?.price || 0}`;
    })
    .join("\n");

  return sendMail({
    from: `"Fabnoor" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "🛒 Order Confirmation - Thank You for Shopping!",
    text: `Your order has been placed successfully.\n\nItems:\n${itemList}\n\nTotal Amount: ₹${amount}\n\nWe will deliver it soon. Thank you! 😊`,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Invoice Email with PDF Attachment
// ─────────────────────────────────────────────────────────────────────────────
export const sendInvoiceEmail = async (toEmail, pdfBuffer) => {
  return sendMail({
    from: `"Fabnoor" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "📦 Your Order Invoice - Delivered",
    text: `Hi there,\n\nWe're happy to let you know that your order has been successfully delivered! 🎉\n\nPlease find your invoice attached with this email for your records.\n\nThank you for shopping with Fabnoor.\n\nBest regards,\nTeam Fabnoor`,
    attachments: [
      {
        filename: "invoice.pdf",
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Reset Password OTP Email
// ─────────────────────────────────────────────────────────────────────────────
export const sendResetOtpEmail = async (toEmail, otp) => {
  console.log(`📧 Sending OTP [${otp}] to: ${toEmail}`);

  const result = await sendMail({
    from: `"Fabnoor" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "🔒 Your Password Reset OTP - Fabnoor",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #f0e0e0;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#e91e8c,#f06292);padding:24px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:24px;">🔒 Password Reset</h1>
        </div>
        <div style="padding:32px;">
          <p style="color:#333;font-size:16px;">Hi there,</p>
          <p style="color:#555;">Use the OTP below to reset your <strong>Fabnoor</strong> account password. It is valid for <strong>10 minutes</strong>.</p>
          <div style="background:#fff5f7;border:2px dashed #e91e8c;border-radius:10px;text-align:center;padding:20px;margin:24px 0;">
            <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#e91e8c;">${otp}</span>
          </div>
          <p style="color:#888;font-size:13px;">If you did not request a password reset, you can safely ignore this email.</p>
          <hr style="border:none;border-top:1px solid #f0e0e0;margin:24px 0;"/>
          <p style="color:#aaa;font-size:12px;text-align:center;">© ${new Date().getFullYear()} Fabnoor. All rights reserved.</p>
        </div>
      </div>
    `,
    text: `Your Fabnoor password reset OTP is: ${otp}\n\nThis OTP is valid for 10 minutes. Do not share it with anyone.`,
  });

  if (!result) {
    console.error("❌ OTP email delivery FAILED for:", toEmail);
  }
  return result;
};
