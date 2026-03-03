import nodemailer from "nodemailer";

/**
 * Brevo (Sendinblue) SMTP — reliable transactional email.
 * Free tier: 300 emails/day. No spam issues. Instant delivery.
 *
 * Required env vars:
 *   BREVO_SMTP_USER  — your Brevo login email (e.g. Fabnoor.nikunj@gmail.com)
 *   BREVO_SMTP_KEY   — your Brevo SMTP key (generated in Brevo → SMTP & API → SMTP)
 */
const createTransporter = () => {
  const user = process.env.BREVO_SMTP_USER;
  const pass = process.env.BREVO_SMTP_KEY;

  if (!user || !pass) {
    console.warn("⚠️  BREVO_SMTP_USER or BREVO_SMTP_KEY not set — emails will NOT be sent.");
    return null;
  }

  return nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: { user, pass },
  });
};

const sendMail = async (mailOptions) => {
  const transporter = createTransporter();
  if (!transporter) return false;

  try {
    const info = await transporter.sendMail(mailOptions);
    const accepted = info?.accepted ?? [];
    console.log("✅ Email sent to:", accepted.join(", ") || mailOptions.to);
    return true;
  } catch (err) {
    console.error("❌ Email send error:", err?.message ?? err);
    if (err?.responseCode) console.error("   SMTP code:", err.responseCode);
    if (err?.response) console.error("   SMTP msg :", err.response);
    return false;
  }
};

// Sender address — must be verified in Brevo dashboard
const FROM = `"Fabnoor" <${process.env.BREVO_SMTP_USER || "noreply@fabnoor.com"}>`;

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
    from: FROM,
    to: toEmail,
    subject: "🛒 Order Confirmation - Thank You for Shopping with Fabnoor!",
    text: `Your order has been placed successfully.\n\nItems:\n${itemList}\n\nTotal Amount: ₹${amount}\n\nWe will deliver it soon. Thank you! 😊\n\n– Team Fabnoor`,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Invoice Email with PDF Attachment
// ─────────────────────────────────────────────────────────────────────────────
export const sendInvoiceEmail = async (toEmail, pdfBuffer) => {
  return sendMail({
    from: FROM,
    to: toEmail,
    subject: "📦 Your Order Invoice - Fabnoor",
    text: `Hi there,\n\nYour order has been delivered! 🎉\n\nPlease find your invoice attached.\n\nThank you for shopping with Fabnoor.\n\nBest regards,\nTeam Fabnoor`,
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
  console.log(`📧 Sending OTP to: ${toEmail}`);

  return sendMail({
    from: FROM,
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
            <span style="font-size:40px;font-weight:bold;letter-spacing:10px;color:#e91e8c;">${otp}</span>
          </div>
          <p style="color:#888;font-size:13px;">Do not share this OTP with anyone. If you did not request a password reset, ignore this email.</p>
          <hr style="border:none;border-top:1px solid #f0e0e0;margin:24px 0;"/>
          <p style="color:#aaa;font-size:12px;text-align:center;">© ${new Date().getFullYear()} Fabnoor. All rights reserved.</p>
        </div>
      </div>
    `,
    text: `Your Fabnoor password reset OTP is: ${otp}\n\nValid for 10 minutes. Do not share it with anyone.`,
  });
};
