import nodemailer from "nodemailer";

/**
 * Gmail nodemailer — creates a fresh transporter each call
 * so an updated App Password takes effect without server restart.
 *
 * Required env vars (set in Render dashboard):
 *   EMAIL_USER  — Gmail address (e.g. Fabnoor.nikunj@gmail.com)
 *   EMAIL_PASS  — 16-char Gmail App Password (myaccount.google.com/apppasswords)
 */
const createTransporter = () => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    console.warn("⚠️  EMAIL_USER or EMAIL_PASS not set — emails disabled.");
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
};

const sendMail = async (mailOptions) => {
  const transporter = createTransporter();
  if (!transporter) return false;

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", info?.accepted ?? mailOptions.to);
    return true;
  } catch (err) {
    console.error("❌ Email error:", err?.message ?? err);
    if (err?.responseCode) console.error("   code:", err.responseCode);
    if (err?.response) console.error("   msg :", err.response);
    return false;
  }
};

const FROM = () => `"Fabnoor" <${process.env.EMAIL_USER}>`;

// ── Order Confirmation ────────────────────────────────────────────────────────
export const sendOrderEmail = async (toEmail, items, amount) => {
  const itemList = (items || [])
    .map((item, i) => {
      const codeInfo = item?.code ? ` [Code: ${item.code}]` : "";
      return `${i + 1}. ${item?.name || "Item"}${codeInfo} (Qty: ${item?.quantity || 0}) - ₹${item?.price || 0}`;
    })
    .join("\n");

  return sendMail({
    from: FROM(),
    to: toEmail,
    subject: "🛒 Order Confirmation - Thank You for Shopping with Fabnoor!",
    text: `Your order has been placed successfully.\n\nItems:\n${itemList}\n\nTotal Amount: ₹${amount}\n\nThank you! 😊\n– Team Fabnoor`,
  });
};

// ── Invoice Email ─────────────────────────────────────────────────────────────
export const sendInvoiceEmail = async (toEmail, pdfBuffer) => {
  return sendMail({
    from: FROM(),
    to: toEmail,
    subject: "📦 Your Order Invoice - Fabnoor",
    text: "Your order has been delivered! Please find your invoice attached.\n\nThank you,\nTeam Fabnoor",
    attachments: [{ filename: "invoice.pdf", content: pdfBuffer, contentType: "application/pdf" }],
  });
};

// ── OTP Email ─────────────────────────────────────────────────────────────────
export const sendResetOtpEmail = async (toEmail, otp) => {
  console.log(`📧 Sending OTP to: ${toEmail}`);

  return sendMail({
    from: FROM(),
    to: toEmail,
    subject: "🔒 Your Password Reset OTP - Fabnoor",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #f0e0e0;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#e91e8c,#f06292);padding:24px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:22px;">🔒 Password Reset - Fabnoor</h1>
        </div>
        <div style="padding:32px;">
          <p style="color:#333;">Hi there,</p>
          <p style="color:#555;">Here is your OTP to reset your Fabnoor password. Valid for <strong>10 minutes</strong>.</p>
          <div style="background:#fff5f7;border:2px dashed #e91e8c;border-radius:10px;text-align:center;padding:24px;margin:24px 0;">
            <span style="font-size:42px;font-weight:bold;letter-spacing:10px;color:#e91e8c;">${otp}</span>
          </div>
          <p style="color:#999;font-size:13px;">Do not share this OTP. If you didn't request this, ignore this email.</p>
        </div>
      </div>
    `,
    text: `Your Fabnoor OTP: ${otp}\n\nValid for 10 minutes. Do not share.`,
  });
};
