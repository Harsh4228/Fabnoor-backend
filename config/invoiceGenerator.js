// backend/config/invoiceGenerator.js

import PDFDocument from "pdfkit";

const generateInvoice = async (order, user) => {
  return new Promise((resolve, reject) => {
    // Create a new PDF document with margins
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];

    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", (err) => reject(err));

    // ----- HEADER -----
    doc
      .fillColor("#e91e63")
      .fontSize(28)
      .text("FABNOOR", 50, 45)
      .fillColor("#444444")
      .fontSize(10)
      .text("The Princess Look", 50, 75);

    doc
      .fontSize(20)
      .text("INVOICE", 50, 50, { align: "right", width: 500 })
      .fontSize(10)
      .text(`Invoice Number: ${order.orderNumber || order._id}`, 50, 75, { align: "right", width: 500 })
      .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 50, 90, { align: "right", width: 500 });

    doc.moveTo(50, 115).lineTo(550, 115).strokeColor("#cccccc").stroke();

    // ----- CUSTOMER & SHIPPING INFO -----
    const customerName = order.address?.fullName || user?.name || "Customer";
    const customerEmail = user?.email || "N/A";
    const phone = order.address?.phone || "N/A";

    doc
      .fontSize(12)
      .fillColor("#333333")
      .text("Billed To:", 50, 130)
      .fontSize(10)
      .fillColor("#555555")
      .text(customerName, 50, 150)
      .text(customerEmail, 50, 165)
      .text(`Phone: ${phone}`, 50, 180);

    doc
      .fontSize(12)
      .fillColor("#333333")
      .text("Shipped To:", 220, 130)
      .fontSize(10)
      .fillColor("#555555")
      .text(order.address?.addressLine || "N/A", 220, 150)
      .text(`${order.address?.city || ""}, ${order.address?.state || ""}`, 220, 165)
      .text(`${order.address?.country || ""} - ${order.address?.pincode || ""}`, 220, 180);

    doc
      .fontSize(12)
      .fillColor("#333333")
      .text("Account Details:", 390, 130)
      .fontSize(10)
      .fillColor("#555555")
      .text(`Payment ID: ${order.paymentId || "N/A"}`, 390, 150)
      .text(`User ID: ${order.userId?._id || order.userId || "Guest"}`, 390, 165)
      .text(`Status: ${order.status || "N/A"}`, 390, 180);

    doc.moveTo(50, 215).lineTo(550, 215).strokeColor("#cccccc").stroke();

    // ----- TABLE HEADERS -----
    let currentY = 235;
    doc.fontSize(10).fillColor("#333333").font("Helvetica-Bold");

    doc.text("Item", 50, currentY);
    doc.text("Variant", 250, currentY);
    doc.text("Qty", 380, currentY, { width: 40, align: "center" });
    doc.text("Price", 430, currentY, { width: 50, align: "right" });
    doc.text("Total", 490, currentY, { width: 60, align: "right" });

    doc.moveTo(50, currentY + 15).lineTo(550, currentY + 15).stroke();
    doc.font("Helvetica");

    // ----- TABLE ROWS -----
    currentY += 25;
    let itemsTotal = 0;

    (order.items || []).forEach((item) => {
      const lineTotal = Number(item.price) * Number(item.quantity);
      itemsTotal += lineTotal;

      const variantDetail = `${item.color || ""} ${item.size ? `(${item.size})` : ""}`;

      doc.fillColor("#555555").fontSize(10);
      doc.text(item.name || "Product", 50, currentY, { width: 190 });
      doc.text(variantDetail, 250, currentY, { width: 120 });
      doc.text(item.quantity?.toString() || "1", 380, currentY, { width: 40, align: "center" });
      doc.text(`Rs. ${item.price}`, 430, currentY, { width: 50, align: "right" });
      doc.text(`Rs. ${lineTotal}`, 490, currentY, { width: 60, align: "right" });

      currentY += 20;
    });

    doc.moveTo(50, currentY + 10).lineTo(550, currentY + 10).stroke();

    // ----- TOTALS -----
    currentY += 25;
    doc.font("Helvetica-Bold").fillColor("#333333");
    doc.text("Grand Total:", 380, currentY, { width: 100, align: "right" });
    doc.fillColor("#e91e63").text(`Rs. ${order.amount}`, 490, currentY, { width: 60, align: "right" });
    doc.font("Helvetica");

    // ----- FOOTER -----
    doc
      .fontSize(10)
      .fillColor("#888888")
      .text("Thank you for shopping with Fabnoor!", 50, 700, { align: "center", width: 500 });

    doc.end();
  });
};

export { generateInvoice };
