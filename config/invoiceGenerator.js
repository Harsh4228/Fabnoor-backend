// backend/config/invoiceGenerator.js

import PDFDocument from "pdfkit";

// generateInvoice(order, user?) -> returns a PDF buffer containing a simple invoice
const generateInvoice = async (order, user) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const buffers = [];

    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });

    doc.on("error", (err) => {
      reject(err);
    });

    // Header
    doc.fontSize(20).text("Invoice", { align: "center" });
    doc.moveDown();

    const orderLabel = order.orderNumber || order._id;
    doc.fontSize(12).text(`Order ID: ${orderLabel}`);
    doc.text(`Customer Email: ${user?.email || (order.user?.email ?? "N/A")}`);
    doc.text(`Order Date: ${new Date(order.createdAt || order.createdAt).toLocaleString()}`);
    doc.moveDown();

    doc.text("Products:");
    (order.items || []).forEach((item, index) => {
      const codeInfo = item.code ? ` (Code: ${item.code})` : "";
      doc.text(`${index + 1}. ${item.name}${codeInfo} x ${item.quantity} = ₹${item.price}`);
    });

    doc.moveDown();
    doc.font("Helvetica-Bold").text(`Total: ₹${order.amount}`, { align: "right" });

    doc.end();
  });
};

export { generateInvoice };
