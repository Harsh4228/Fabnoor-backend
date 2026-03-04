import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Sends a WhatsApp message using Meta's official Cloud API.
 * Requires WHATSAPP_TOKEN, WHATSAPP_PHONE_ID in .env
 */
const sendWhatsAppMessage = async (to, message) => {
    try {
        const token = process.env.WHATSAPP_TOKEN;
        const phoneId = process.env.WHATSAPP_PHONE_ID;

        if (!token || !phoneId) {
            console.warn("⚠️ WhatsApp Cloud API credentials missing in .env! (WHATSAPP_TOKEN, WHATSAPP_PHONE_ID)");
            return false;
        }

        // Ensure the number has the country code properly formatted
        // WhatsApp Cloud API requires numbers without '+' symbol, just the numeric string e.g., '919876543210'
        const cleanNumber = to.replace(/[^0-9]/g, '');

        const response = await axios.post(
            `https://graph.facebook.com/v19.0/${phoneId}/messages`,
            {
                messaging_product: "whatsapp",
                to: cleanNumber,
                type: "text",
                text: { body: message }
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`✅ WhatsApp message sent to ${cleanNumber}. ID:`, response.data.messages[0].id);
        return true;

    } catch (error) {
        if (error.response) {
            console.error("❌ WhatsApp API Error:", error.response.data.error.message);
        } else {
            console.error("❌ WhatsApp Send Error:", error.message);
        }
        return false;
    }
};

export { sendWhatsAppMessage };
