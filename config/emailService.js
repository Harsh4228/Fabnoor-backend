import nodemailer from "nodemailer";

// Create a single transporter instance and reuse it to reduce overhead
let transporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    pool: true,
  });

  transporter.verify().then(() => {
    console.log("✅ Email transporter verified");
  }).catch((err) => {
    console.warn("⚠️ Email transporter verification failed:", err.message || err);
  });
} else {
  // Fallback no-op transporter (useful in development or when env not configured)
  transporter = {
    sendMail: async (opts) => {
      console.warn("EMAIL DISABLED - would send:", opts.to, opts.subject);
      return Promise.resolve({ accepted: [], rejected: [] });
    },
  };
}

// Order Confirmation Email - errors are handled internally so callers can fire-and-forget
export const sendOrderEmail = async (toEmail, items, amount) => {
  try {
    const itemList = (items || [])
      .map((item, i) => {
        const codeInfo = item?.code ? ` [Code: ${item.code}]` : "";
        return `${i + 1}. ${item?.name || 'Item'}${codeInfo} (Qty: ${item?.quantity || 0}) - ₹${item?.price || 0}`;
      })
      .join("\n");

    const mailOptions = {
      from: `"ForEver" <${process.env.EMAIL_USER || "no-reply@local"}>`,
      to: toEmail,
      subject: "🛒 Order Confirmation - Thank You for Shopping!",
      text: `Your order has been placed successfully.\n\nItems:\n${itemList}\n\nTotal Amount: ₹${amount}\n\nWe will deliver it soon. Thank you! 😊`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Order email sent (or queued):", toEmail, info && info.accepted ? info.accepted : "OK");
    return true;
  } catch (err) {
    console.error("❌ Error sending order email:", err);
    return false;
  }
};

// Invoice Email with PDF Attachment
export const sendInvoiceEmail = async (toEmail, pdfBuffer) => {
  try {
    const mailOptions = {
      from: `"ForEver" <${process.env.EMAIL_USER || "no-reply@local"}>`,
      to: toEmail,
      subject: "📦 Your Order Invoice - Delivered",
      text: `Hi there,\n\nWe're happy to let you know that your order has been successfully delivered! 🎉\n\nPlease find your invoice attached with this email for your records.\n\nThank you for shopping with ForEver.\n\nBest regards,\nTeam ForEver`,
      attachments: [
        {
          filename: "invoice.pdf",
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Invoice email sent (or queued):", toEmail, info && info.accepted ? info.accepted : "OK");
    return true;
  } catch (err) {
    console.error("❌ Error sending invoice email:", err);
    return false;
  }
};
