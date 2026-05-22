import jsPDF from "jspdf";
import { TripPayment } from "@/hooks/useTripPayments";
import { format } from "date-fns";

export interface InvoiceData {
  invoiceNumber?: string;
  tripName: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  destination?: string;
  departDate?: string;
  returnDate?: string;
  payments: TripPayment[];
  tripTotal: number;
  totalPaid: number;
  totalRemaining: number;
  agencyName?: string;
  agencyPhone?: string;
  agencyEmail?: string;
  agencyAddress?: string;
  agencyWebsite?: string;
  agencyLogoUrl?: string;
  supplierName?: string;
  lineItems?: InvoiceLineItem[];
}

export interface InvoiceLineItem {
  description: string;
  reference?: string;
  supplier?: string;
  status?: string;
  amount: number;
  subItems?: InvoiceSubLineItem[];
}

export interface InvoiceSubLineItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
  isPassThrough?: boolean;
}

interface GenerateOptions {
  returnBase64?: boolean;
  returnBlobUrl?: boolean;
}

// Helper to load image as base64
const loadImageAsBase64 = (url: string): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
};

const isInvoiceCashPayment = (payment: TripPayment) => {
  const details = (payment.details || "").toLowerCase();
  const isSchedulePlaceholder =
    !!payment.due_date &&
    !payment.payment_date &&
    !payment.payment_method &&
    !payment.stripe_session_id &&
    !payment.stripe_receipt_url &&
    (["installment", "final", "final_balance"].includes(payment.payment_type) ||
      details.startsWith("installment") ||
      details.startsWith("final balance"));

  return payment.status === "paid" && !isSchedulePlaceholder;
};

const isUpcomingPaymentDue = (payment: TripPayment) => payment.status === "pending" && !!payment.due_date;

export async function generateInvoicePDF(data: InvoiceData, options?: GenerateOptions): Promise<string | void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 25;

  // Colors matching the template
  const primaryColor: [number, number, number] = [0, 150, 167]; // Teal #0096A7
  const textColor: [number, number, number] = [51, 51, 51];
  const mutedColor: [number, number, number] = [102, 102, 102];
  const lightGray: [number, number, number] = [200, 200, 200];

  // Use provided invoice number or generate fallback
  const invoiceNumber = data.invoiceNumber || `INV-${Date.now().toString().slice(-10).toUpperCase()}`;

  // ===== PAGE 1 =====
  
  // Header - "Invoice" title
  doc.setFontSize(28);
  doc.setTextColor(...primaryColor);
  doc.setFont("helvetica", "bold");
  doc.text("Invoice", margin, yPos);

  // Try to load and add agency logo (top right) — wide aspect ratio
  const logoWidth = 55;
  const logoHeight = 36;
  const logoX = pageWidth - margin - logoWidth;
  const logoY = yPos - 22;
  let logoAdded = false;

  // Try agency logo URL first, then fall back to default local logo
  const logoSources = [
    data.agencyLogoUrl,
    "/images/logo_simplified.png",
  ].filter(Boolean) as string[];

  for (const logoSrc of logoSources) {
    try {
      const logoBase64 = await loadImageAsBase64(logoSrc);
      if (logoBase64) {
        doc.addImage(logoBase64, "PNG", logoX, logoY, logoWidth, logoHeight, undefined, "FAST");
        logoAdded = true;
        break;
      }
    } catch (e) {
      console.warn("Failed to load logo from", logoSrc, e);
    }
  }

  // Fallback: Draw text badge if no logo loaded at all
  if (!logoAdded) {
    doc.setFontSize(10);
    doc.setTextColor(...primaryColor);
    doc.setFont("helvetica", "bold");
    const badgeX = pageWidth - margin - 30;
    doc.text("Crestwell", badgeX + 15, yPos - 8, { align: "center" });
    doc.setFontSize(9);
    doc.text("Travel", badgeX + 15, yPos - 3, { align: "center" });
    doc.setFontSize(8);
    doc.text("Services", badgeX + 15, yPos + 2, { align: "center" });
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.roundedRect(badgeX, yPos - 15, 30, 22, 3, 3, "S");
  }

  // Invoice Number and Issue Date
  yPos += 15;
  doc.setFontSize(10);
  doc.setTextColor(...mutedColor);
  doc.setFont("helvetica", "normal");
  doc.text("Invoice Number", margin, yPos);
  doc.text("Issue Date", margin, yPos + 6);
  
  doc.setTextColor(...textColor);
  doc.text(invoiceNumber, margin + 35, yPos);
  doc.text(format(new Date(), "MMM d, yyyy"), margin + 35, yPos + 6);

  // ===== Three Column Header Section =====
  yPos += 20;
  const colWidth = (pageWidth - margin * 2) / 3;
  
  // Column 1: Agency Info
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textColor);
  doc.text(data.agencyName || "Crestwell Travel Services", margin, yPos);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);
  let agencyY = yPos + 5;
  
  if (data.agencyEmail) {
    doc.text(data.agencyEmail, margin, agencyY);
    agencyY += 4;
  }
  if (data.agencyPhone) {
    doc.text(data.agencyPhone, margin, agencyY);
    agencyY += 4;
  }
  if (data.agencyAddress) {
    const addressLines = doc.splitTextToSize(data.agencyAddress, colWidth - 5);
    doc.text(addressLines, margin, agencyY);
    agencyY += addressLines.length * 4;
  }
  
  // Column 2: Primary Traveler
  const col2X = margin + colWidth;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...mutedColor);
  doc.text("Primary Traveler", col2X, yPos);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textColor);
  doc.text(data.clientName, col2X, yPos + 5);
  
  let travelerY = yPos + 10;
  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);
  if (data.clientEmail) {
    doc.text(data.clientEmail, col2X, travelerY);
    travelerY += 4;
  }
  if (data.clientPhone) {
    doc.text(data.clientPhone, col2X, travelerY);
    travelerY += 4;
  }
  
  // Column 3: Trip Details
  const col3X = margin + colWidth * 2;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...mutedColor);
  doc.text("Trip Details", col3X, yPos);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textColor);
  doc.text(data.tripName, col3X, yPos + 5);
  
  if (data.departDate) {
    const dateRange = data.returnDate 
      ? `${format(new Date(data.departDate), "MMM d")} - ${format(new Date(data.returnDate), "MMM d, yyyy")}`
      : format(new Date(data.departDate), "MMM d, yyyy");
    doc.setFontSize(8);
    doc.setTextColor(...mutedColor);
    doc.text(dateRange, col3X, yPos + 10);
  }

  // ===== Balance Summary Box =====
  yPos += 35;
  const boxX = margin;
  const boxW = pageWidth - margin * 2;
  const boxH = 32;
  doc.setFillColor(245, 250, 251);
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.4);
  doc.roundedRect(boxX, yPos, boxW, boxH, 2, 2, "FD");

  const cellW = boxW / 3;
  const cellY = yPos + 8;
  const valueY = yPos + 22;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...mutedColor);
  doc.text("TRIP TOTAL", boxX + cellW * 0.5, cellY, { align: "center" });
  doc.text("PAYMENTS APPLIED", boxX + cellW * 1.5, cellY, { align: "center" });
  doc.text("BALANCE DUE", boxX + cellW * 2.5, cellY, { align: "center" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textColor);
  doc.text(formatCurrency(data.tripTotal), boxX + cellW * 0.5, valueY, { align: "center" });
  doc.text(formatCurrency(data.totalPaid), boxX + cellW * 1.5, valueY, { align: "center" });
  doc.setTextColor(...primaryColor);
  doc.text(formatCurrency(data.totalRemaining), boxX + cellW * 2.5, valueY, { align: "center" });

  // Vertical separators
  doc.setDrawColor(...lightGray);
  doc.setLineWidth(0.2);
  doc.line(boxX + cellW, yPos + 4, boxX + cellW, yPos + boxH - 4);
  doc.line(boxX + cellW * 2, yPos + 4, boxX + cellW * 2, yPos + boxH - 4);

  yPos += boxH + 12;

  // ===== Payments History Table =====
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textColor);
  doc.text("Payment Schedule", margin, yPos);
  yPos += 6;

  // Table Header
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, yPos - 4, pageWidth - margin * 2, 8, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...mutedColor);
  doc.text("Description", margin + 2, yPos + 1);
  doc.text("Status", margin + 95, yPos + 1);
  doc.text("Amount", pageWidth - margin - 2, yPos + 1, { align: "right" });
  yPos += 10;

  doc.setFont("helvetica", "normal");
  // If the trip is fully paid (or overpaid), drop any still-pending
  // installments from the schedule — the balance has already been covered
  // and showing a future "Due" row is misleading on the invoice.
  const fullyPaid = (data.totalPaid || 0) >= (data.tripTotal || 0) && (data.tripTotal || 0) > 0;
  const scheduleRows = data.payments
    .filter((p) => isInvoiceCashPayment(p) || (!fullyPaid && isUpcomingPaymentDue(p)))
    .sort((a, b) => {
      const aDate = a.status === "pending" ? a.due_date || a.payment_date : a.payment_date || a.due_date;
      const bDate = b.status === "pending" ? b.due_date || b.payment_date : b.payment_date || b.due_date;
      return new Date(aDate || 0).getTime() - new Date(bDate || 0).getTime();
    });

  if (scheduleRows.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);
    doc.text("No payments recorded yet.", margin + 2, yPos);
    yPos += 6;
  } else {
    scheduleRows.forEach((payment) => {
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = 25;
      }

      let description = payment.payment_type === "final_balance"
        ? "Final balance"
        : payment.payment_type === "deposit"
          ? "Deposit"
          : payment.payment_type === "installment"
            ? "Installment"
            : payment.payment_type.charAt(0).toUpperCase() + payment.payment_type.slice(1).replace(/_/g, " ");

      const dateRef = payment.payment_date || payment.due_date;
      const dateStr = dateRef ? format(new Date(dateRef), "MMM d, yyyy") : "";
      const statusText = payment.status === "paid"
        ? `${dateStr} · Paid`
        : payment.status === "pending" && dateStr
          ? `Due ${dateStr}`
          : payment.status.charAt(0).toUpperCase() + payment.status.slice(1);

      doc.setFontSize(9);
      doc.setTextColor(...textColor);
      doc.text(description, margin + 2, yPos);
      doc.setTextColor(...mutedColor);
      doc.text(statusText, margin + 95, yPos);
      doc.setTextColor(...textColor);
      doc.text(formatCurrency(payment.amount), pageWidth - margin - 2, yPos, { align: "right" });
      yPos += 6;
    });
  }

  // Totals row
  yPos += 4;
  doc.setDrawColor(...lightGray);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.text("Total Paid", margin + 95, yPos);
  doc.setTextColor(...textColor);
  doc.text(formatCurrency(data.totalPaid), pageWidth - margin - 2, yPos, { align: "right" });
  yPos += 6;
  doc.setTextColor(...mutedColor);
  doc.text("Balance Due", margin + 95, yPos);
  doc.setTextColor(...primaryColor);
  doc.text(formatCurrency(data.totalRemaining), pageWidth - margin - 2, yPos, { align: "right" });

  // ===== PAGE 2 - Detailed Line Items + Terms =====
  doc.addPage();
  yPos = 25;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryColor);
  doc.text("Detailed Line Items", margin, yPos);
  yPos += 4;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...mutedColor);
  doc.text(`Invoice ${invoiceNumber} · ${data.tripName}`, margin, yPos + 4);
  yPos += 14;

  // Line items table header
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, yPos - 4, pageWidth - margin * 2, 8, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...mutedColor);
  doc.text("Item", margin + 2, yPos + 1);
  doc.text("Reference", margin + 80, yPos + 1);
  doc.text("Status", margin + 125, yPos + 1);
  doc.text("Amount", pageWidth - margin - 2, yPos + 1, { align: "right" });
  yPos += 10;

  doc.setFont("helvetica", "normal");
  const items = data.lineItems && data.lineItems.length > 0 ? data.lineItems : [];
  let lineTotal = 0;
  if (items.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);
    doc.text("No itemized bookings available for this invoice.", margin + 2, yPos);
    yPos += 8;
    lineTotal = data.tripTotal;
  } else {
    items.forEach((item) => {
      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = 25;
      }
      doc.setFontSize(9);
      doc.setTextColor(...textColor);
      const descLines = doc.splitTextToSize(item.description, 75);
      doc.text(descLines, margin + 2, yPos);
      if (item.supplier) {
        doc.setFontSize(8);
        doc.setTextColor(...mutedColor);
        doc.text(item.supplier, margin + 2, yPos + 4 + (descLines.length - 1) * 4);
      }
      doc.setFontSize(9);
      doc.setTextColor(...textColor);
      doc.text(item.reference || "—", margin + 80, yPos);
      doc.setTextColor(...mutedColor);
      doc.text(item.status || "—", margin + 125, yPos);
      doc.setTextColor(...textColor);
      doc.text(formatCurrency(item.amount), pageWidth - margin - 2, yPos, { align: "right" });
      lineTotal += item.amount;
      yPos += 6 + (descLines.length - 1) * 4 + (item.supplier ? 4 : 0);
      // Sub-items (margin lines)
      if (item.subItems && item.subItems.length > 0) {
        item.subItems.forEach((sub) => {
          if (yPos > pageHeight - 60) {
            doc.addPage();
            yPos = 25;
          }
          doc.setFontSize(8);
          doc.setTextColor(...mutedColor);
          const subDesc = sub.quantity && sub.quantity > 1
            ? `  • ${sub.description} (${sub.quantity} × ${formatCurrency(sub.unitPrice || 0)})`
            : `  • ${sub.description}`;
          const subLines = doc.splitTextToSize(subDesc, 110);
          doc.text(subLines, margin + 4, yPos);
          doc.text(formatCurrency(sub.amount), pageWidth - margin - 2, yPos, { align: "right" });
          yPos += 4 + (subLines.length - 1) * 4;
        });
        yPos += 2;
      }
    });
  }

  // Totals
  yPos += 4;
  doc.setDrawColor(...lightGray);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...mutedColor);
  doc.text("Subtotal", margin + 125, yPos);
  doc.setTextColor(...textColor);
  doc.text(formatCurrency(lineTotal), pageWidth - margin - 2, yPos, { align: "right" });
  yPos += 6;
  doc.setTextColor(...mutedColor);
  doc.text("Payments Applied", margin + 125, yPos);
  doc.setTextColor(...textColor);
  doc.text(`-${formatCurrency(data.totalPaid)}`, pageWidth - margin - 2, yPos, { align: "right" });
  yPos += 6;
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text("Balance Due", margin + 125, yPos);
  doc.text(formatCurrency(data.totalRemaining), pageWidth - margin - 2, yPos, { align: "right" });

  // ===== Terms & Footer =====
  yPos += 18;
  if (yPos > pageHeight - 60) {
    doc.addPage();
    yPos = 25;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...textColor);
  doc.text("Terms & Notes", margin, yPos);
  yPos += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  const termsText = "Payment is due upon receipt unless otherwise specified. We accept ACH and credit card. Late payments may be subject to a service fee as outlined in your agreement. We value your business and look forward to continuing to support your travel plans.";
  const termsLines = doc.splitTextToSize(termsText, pageWidth - margin * 2);
  doc.text(termsLines, margin, yPos);
  yPos += termsLines.length * 4 + 8;

  doc.setTextColor(...textColor);
  doc.text("Warm regards,", margin, yPos);
  yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.text(`The ${data.agencyName || "Crestwell Travel Services"} Team`, margin, yPos);

  // Contact footer
  yPos += 12;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...mutedColor);
  const contactParts = [
    data.agencyPhone || "888.508.6893",
    data.agencyEmail || "info@crestwellgetaways.com",
    data.agencyWebsite || "https://www.crestwellgetaways.com",
  ].filter(Boolean);
  doc.text(contactParts.join(" | "), margin, yPos);

  // Return base64 or blob URL or save the PDF
  if (options?.returnBase64) {
    return doc.output("datauristring").split(",")[1];
  }

  if (options?.returnBlobUrl) {
    const blob = doc.output("blob");
    return URL.createObjectURL(blob);
  }
  
  const fileName = `Invoice_${data.tripName.replace(/[^a-zA-Z0-9]/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
}
