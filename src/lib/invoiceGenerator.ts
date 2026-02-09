import jsPDF from "jspdf";
import { TripPayment } from "@/hooks/useTripPayments";
import { format } from "date-fns";

interface InvoiceData {
  tripName: string;
  clientName: string;
  clientEmail?: string;
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
}

export function generateInvoicePDF(data: InvoiceData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Colors
  const primaryColor: [number, number, number] = [13, 115, 119]; // #0D7377
  const textColor: [number, number, number] = [51, 51, 51];
  const mutedColor: [number, number, number] = [128, 128, 128];

  // Helper function to add text
  const addText = (
    text: string,
    x: number,
    y: number,
    options?: { fontSize?: number; color?: [number, number, number]; fontStyle?: string; align?: "left" | "center" | "right" }
  ) => {
    const { fontSize = 10, color = textColor, fontStyle = "normal", align = "left" } = options || {};
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    doc.setFont("helvetica", fontStyle);
    doc.text(text, x, y, { align });
  };

  // Header - Agency Info
  addText(data.agencyName || "Crestwell Travel Services", 20, yPos, { fontSize: 18, fontStyle: "bold", color: primaryColor });
  yPos += 8;
  
  if (data.agencyPhone || data.agencyEmail) {
    const contactInfo = [data.agencyPhone, data.agencyEmail].filter(Boolean).join(" | ");
    addText(contactInfo, 20, yPos, { fontSize: 9, color: mutedColor });
    yPos += 5;
  }
  
  if (data.agencyAddress) {
    addText(data.agencyAddress, 20, yPos, { fontSize: 9, color: mutedColor });
    yPos += 5;
  }

  // Invoice Title
  yPos += 10;
  addText("INVOICE", pageWidth - 20, yPos, { fontSize: 24, fontStyle: "bold", color: primaryColor, align: "right" });
  
  // Invoice Number & Date
  yPos += 8;
  const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
  addText(`Invoice #: ${invoiceNumber}`, pageWidth - 20, yPos, { fontSize: 10, align: "right" });
  yPos += 5;
  addText(`Date: ${format(new Date(), "MMMM d, yyyy")}`, pageWidth - 20, yPos, { fontSize: 10, align: "right" });

  // Divider
  yPos += 10;
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.line(20, yPos, pageWidth - 20, yPos);

  // Bill To Section
  yPos += 10;
  addText("BILL TO:", 20, yPos, { fontSize: 10, fontStyle: "bold", color: mutedColor });
  yPos += 6;
  addText(data.clientName, 20, yPos, { fontSize: 12, fontStyle: "bold" });
  if (data.clientEmail) {
    yPos += 5;
    addText(data.clientEmail, 20, yPos, { fontSize: 10, color: mutedColor });
  }

  // Trip Details Section
  yPos += 15;
  addText("TRIP DETAILS:", 20, yPos, { fontSize: 10, fontStyle: "bold", color: mutedColor });
  yPos += 6;
  addText(data.tripName, 20, yPos, { fontSize: 12, fontStyle: "bold" });
  
  if (data.destination) {
    yPos += 5;
    addText(`Destination: ${data.destination}`, 20, yPos, { fontSize: 10 });
  }
  
  if (data.departDate) {
    yPos += 5;
    const dateRange = data.returnDate 
      ? `${format(new Date(data.departDate), "MMM d, yyyy")} - ${format(new Date(data.returnDate), "MMM d, yyyy")}`
      : format(new Date(data.departDate), "MMM d, yyyy");
    addText(`Travel Dates: ${dateRange}`, 20, yPos, { fontSize: 10 });
  }

  // Payments Table
  yPos += 15;
  
  // Table Header
  doc.setFillColor(...primaryColor);
  doc.rect(20, yPos, pageWidth - 40, 8, "F");
  yPos += 5.5;
  
  addText("Description", 25, yPos, { fontSize: 9, fontStyle: "bold", color: [255, 255, 255] });
  addText("Due Date", 100, yPos, { fontSize: 9, fontStyle: "bold", color: [255, 255, 255] });
  addText("Status", 135, yPos, { fontSize: 9, fontStyle: "bold", color: [255, 255, 255] });
  addText("Amount", pageWidth - 25, yPos, { fontSize: 9, fontStyle: "bold", color: [255, 255, 255], align: "right" });
  
  yPos += 5;

  // Table Rows
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  data.payments.forEach((payment, index) => {
    yPos += 7;
    
    // Alternate row background
    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(20, yPos - 4.5, pageWidth - 40, 7, "F");
    }

    const description = payment.bookings 
      ? payment.bookings.trip_name || payment.bookings.destination || "Trip Payment"
      : payment.payment_type === "final_balance" 
        ? "Final Balance" 
        : payment.payment_type.charAt(0).toUpperCase() + payment.payment_type.slice(1);
    
    addText(description.substring(0, 40), 25, yPos, { fontSize: 9 });
    addText(payment.due_date ? format(new Date(payment.due_date), "MMM d, yyyy") : "-", 100, yPos, { fontSize: 9 });
    addText(payment.status.charAt(0).toUpperCase() + payment.status.slice(1), 135, yPos, { fontSize: 9 });
    addText(formatCurrency(payment.amount), pageWidth - 25, yPos, { fontSize: 9, align: "right" });
  });

  // Totals Section
  yPos += 15;
  doc.setDrawColor(200, 200, 200);
  doc.line(pageWidth - 80, yPos, pageWidth - 20, yPos);
  
  yPos += 8;
  addText("Trip Total:", pageWidth - 80, yPos, { fontSize: 10 });
  addText(formatCurrency(data.tripTotal), pageWidth - 25, yPos, { fontSize: 10, fontStyle: "bold", align: "right" });
  
  yPos += 6;
  addText("Amount Paid:", pageWidth - 80, yPos, { fontSize: 10, color: mutedColor });
  addText(formatCurrency(data.totalPaid), pageWidth - 25, yPos, { fontSize: 10, align: "right" });
  
  yPos += 8;
  doc.setFillColor(...primaryColor);
  doc.rect(pageWidth - 85, yPos - 5, 65, 10, "F");
  addText("Balance Due:", pageWidth - 80, yPos + 1, { fontSize: 10, fontStyle: "bold", color: [255, 255, 255] });
  addText(formatCurrency(data.totalRemaining), pageWidth - 25, yPos + 1, { fontSize: 10, fontStyle: "bold", color: [255, 255, 255], align: "right" });

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(...primaryColor);
  doc.line(20, footerY - 5, pageWidth - 20, footerY - 5);
  addText("Thank you for choosing " + (data.agencyName || "Crestwell Travel Services") + "!", pageWidth / 2, footerY, { 
    fontSize: 10, 
    color: mutedColor, 
    align: "center" 
  });

  // Save the PDF
  const fileName = `Invoice_${data.tripName.replace(/[^a-zA-Z0-9]/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
}
