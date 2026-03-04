import PDFDocument from "pdfkit";

/**
 * Generates a styled WhatsApp Order Slip PDF.
 * Includes customer info, delivery address, and order items.
 */
const generateOrderSlip = async (order, user) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: "A5" });
        const buffers = [];

        doc.on("data", (chunk) => buffers.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(buffers)));
        doc.on("error", (err) => reject(err));

        const pink = "#e91e63";
        const dark = "#222222";
        const mid = "#555555";
        const light = "#888888";
        const W = 419; // A5 width in pts

        // ── HEADER BAND ───────────────────────────────────────────
        doc.rect(0, 0, W, 60).fill(pink);

        doc
            .fillColor("#ffffff")
            .fontSize(22)
            .font("Helvetica-Bold")
            .text("FABNOOR", 40, 14);

        doc
            .fillColor("rgba(255,255,255,0.75)")
            .fontSize(9)
            .font("Helvetica")
            .text("The Princess Look", 40, 38);

        doc
            .fillColor("#ffffff")
            .fontSize(9)
            .font("Helvetica-Bold")
            .text("ORDER SLIP", 0, 22, { align: "right", width: W - 40 });

        doc
            .fillColor("rgba(255,255,255,0.8)")
            .fontSize(8)
            .font("Helvetica")
            .text(`#${order.orderNumber || order._id}`, 0, 35, {
                align: "right",
                width: W - 40,
            })
            .text(new Date(order.createdAt).toLocaleDateString("en-IN"), 0, 46, {
                align: "right",
                width: W - 40,
            });

        // ── DELIVERY ADDRESS BOX ──────────────────────────────────
        let y = 75;
        doc
            .fillColor(dark)
            .fontSize(9)
            .font("Helvetica-Bold")
            .text("DELIVER TO", 40, y);

        y += 12;
        doc
            .rect(40, y, W - 80, 80)
            .strokeColor("#f0c0d0")
            .lineWidth(1)
            .stroke();

        y += 10;
        doc
            .fillColor(dark)
            .fontSize(10)
            .font("Helvetica-Bold")
            .text(order.address?.fullName || "Customer", 50, y);

        y += 14;
        doc
            .fillColor(mid)
            .fontSize(9)
            .font("Helvetica")
            .text(order.address?.addressLine || "", 50, y, { width: W - 100 });

        y += 12;
        doc.text(
            `${order.address?.city || ""}, ${order.address?.state || ""} - ${order.address?.pincode || ""}`,
            50,
            y
        );

        y += 12;
        doc.text(order.address?.country || "", 50, y);

        y += 12;
        doc
            .fillColor(pink)
            .fontSize(9)
            .font("Helvetica-Bold")
            .text(`📞 ${order.address?.phone || ""}`, 50, y);

        // ── DIVIDER ───────────────────────────────────────────────
        y += 30;
        doc.moveTo(40, y).lineTo(W - 40, y).strokeColor("#eeeeee").lineWidth(1).stroke();
        y += 10;

        // ── CUSTOMER INFO ─────────────────────────────────────────
        doc
            .fillColor(dark)
            .fontSize(9)
            .font("Helvetica-Bold")
            .text("CUSTOMER", 40, y);

        y += 12;
        doc
            .fillColor(mid)
            .fontSize(9)
            .font("Helvetica")
            .text(`Email: ${user?.email || "N/A"}`, 40, y);

        y += 12;
        doc.text(`Payment: ${order.paymentMethod || "WhatsApp"}`, 40, y);

        // ── DIVIDER ───────────────────────────────────────────────
        y += 18;
        doc.moveTo(40, y).lineTo(W - 40, y).strokeColor("#eeeeee").lineWidth(1).stroke();
        y += 10;

        // ── ITEMS TABLE ───────────────────────────────────────────
        doc.fillColor(dark).fontSize(9).font("Helvetica-Bold").text("ITEMS", 40, y);

        y += 12;

        // Header row
        doc
            .rect(40, y, W - 80, 16)
            .fill("#fce4ec");

        doc
            .fillColor(pink)
            .fontSize(8)
            .font("Helvetica-Bold")
            .text("Product", 44, y + 4, { width: 140 })
            .text("Color / Fabric", 190, y + 4, { width: 100 })
            .text("Qty", 0, y + 4, { width: W - 44, align: "right" });

        y += 18;
        doc.font("Helvetica");

        (order.items || []).forEach((item, i) => {
            if (i % 2 === 0) {
                doc.rect(40, y - 2, W - 80, 16).fill("#fafafa");
            }

            doc
                .fillColor(dark)
                .fontSize(8)
                .text(item.name || "Product", 44, y, { width: 140 });

            doc
                .fillColor(mid)
                .text(
                    `${item.color || ""}${item.fabric ? ` / ${item.fabric}` : ""}`,
                    190,
                    y,
                    { width: 100 }
                );

            doc
                .fillColor(dark)
                .font("Helvetica-Bold")
                .text(`x${item.quantity}`, 0, y, { width: W - 44, align: "right" });

            doc.font("Helvetica");
            y += 16;
        });

        // ── TOTAL ROW ─────────────────────────────────────────────
        y += 4;
        doc.moveTo(40, y).lineTo(W - 40, y).strokeColor("#eeeeee").stroke();
        y += 8;

        doc
            .fillColor(dark)
            .font("Helvetica-Bold")
            .fontSize(10)
            .text("Total Amount:", 40, y)
            .fillColor(pink)
            .text(`Rs. ${order.amount}`, 0, y, {
                align: "right",
                width: W - 40,
            });

        // ── FOOTER ────────────────────────────────────────────────
        y += 30;
        doc
            .fillColor(light)
            .fontSize(8)
            .font("Helvetica")
            .text("Thank you for shopping with Fabnoor! 💖", 0, y, {
                align: "center",
                width: W,
            });

        doc.end();
    });
};

export { generateOrderSlip };
