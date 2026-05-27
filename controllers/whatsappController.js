import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

/* ── Send a single template message ────────────────────── */
const sendTemplateMessage = async (to, templateName, customerName) => {
  try {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;

    if (!token || !phoneId) return { success: false, error: "Missing credentials" };

    const cleanNumber = to.replace(/[^0-9]/g, "");
    const formattedNumber = cleanNumber.length === 10 ? `91${cleanNumber}` : cleanNumber;

    const isHelloWorld = templateName === "hello_world";

    const templatePayload = {
      name: templateName,
      language: { code: isHelloWorld ? "en_US" : "en" },
    };

    if (!isHelloWorld) {
      const headerImageUrl = process.env.WHATSAPP_HEADER_IMAGE_URL;
      templatePayload.components = [
        ...(headerImageUrl ? [{
          type: "header",
          parameters: [
            {
              type: "image",
              image: { link: headerImageUrl },
            },
          ],
        }] : []),
        {
          type: "body",
          parameters: [
            {
              type: "text",
              parameter_name: "customer_name",
              text: customerName || "Customer",
            },
          ],
        },
      ];
    }

    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${phoneId}/messages`,
      {
        messaging_product: "whatsapp",
        to: formattedNumber,
        type: "template",
        template: templatePayload,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`[WA] Sent to ${formattedNumber}:`, response.data);
    return { success: true };
  } catch (error) {
    const errData = error.response?.data?.error;
    console.error(`[WA] Failed:`, errData || error.message);
    const msg = errData?.message || error.message || "Unknown error";
    return { success: false, error: msg };
  }
};

/* ── POST /api/whatsapp/broadcast ───────────────────────── */
export const broadcastMessage = async (req, res) => {
  try {
    const { contacts, templateName } = req.body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.json({ success: false, message: "No contacts provided" });
    }
    if (!templateName) {
      return res.json({ success: false, message: "Template name is required" });
    }

    const sent = [];
    const failed = [];

    for (const contact of contacts) {
      const { name, mobile } = contact;

      if (!mobile || mobile.trim() === "") {
        failed.push({ name: name || "Unknown", mobile: mobile || "", error: "Missing mobile number" });
        continue;
      }

      const result = await sendTemplateMessage(mobile.trim(), templateName, name || "Customer");

      if (result.success) {
        sent.push({ name: name || "Customer", mobile: mobile.trim() });
      } else {
        failed.push({ name: name || "Customer", mobile: mobile.trim(), error: result.error });
      }

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 200));
    }

    return res.json({
      success: true,
      results: { sent, failed, total: contacts.length },
    });
  } catch (error) {
    console.error("[broadcast] error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
