import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface InvoiceItem {
  product: string;
  qty: number;
  unit: string;
  price: number;
  total: number;
  baseCost?: number;
  totalBaseCost?: number;
  packageSize?: number;
  numPackages?: number;
}

interface InvoiceData {
  clientName: string;
  deliveryDate: string;
  orderDate: string;
  items: InvoiceItem[];
  totalRevenue: number;
  logoBase64?: string;
  isSupermarket?: boolean;
}

function addLogo(doc: jsPDF, logoBase64?: string) {
  if (logoBase64) {
    doc.addImage(logoBase64, "JPEG", 14, 8, 20, 20);
    doc.setFontSize(20);
    doc.setTextColor(34, 87, 52);
    doc.text("Ahla Nabta", 38, 22);
  } else {
    doc.setFontSize(20);
    doc.setTextColor(34, 87, 52);
    doc.text("Ahla Nabta", 14, 22);
  }
}

export function generateInvoicePDF(data: InvoiceData) {
  const doc = new jsPDF();

  addLogo(doc, data.logoBase64);

  const headerOffset = data.logoBase64 ? 34 : 30;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("INVOICE", data.logoBase64 ? 38 : 14, headerOffset);

  doc.setFontSize(11);
  doc.setTextColor(40);
  const infoY = headerOffset + 12;
  doc.text(`Client: ${data.clientName}`, 14, infoY);
  doc.text(`Order Date: ${data.orderDate}`, 14, infoY + 7);
  doc.text(`Delivery Date: ${data.deliveryDate}`, 14, infoY + 14);

  if (data.isSupermarket) {
    autoTable(doc, {
      startY: infoY + 22,
      head: [["Product", "Pckgs", "Price/Pack", "Total"]],
      body: data.items.map((i) => [
        i.product,
        i.numPackages ? i.numPackages.toString() : i.qty.toString(),
        i.price.toFixed(2),
        i.total.toFixed(2),
      ]),
      theme: "striped",
      headStyles: { fillColor: [34, 87, 52] },
    });
  } else {
    autoTable(doc, {
      startY: infoY + 22,
      head: [["Product", "Qty", "Unit", "Price", "Total"]],
      body: data.items.map((i) => [
        i.product,
        i.qty.toString(),
        i.unit,
        i.price.toFixed(2),
        i.total.toFixed(2),
      ]),
      theme: "striped",
      headStyles: { fillColor: [34, 87, 52] },
    });
  }

  const finalY = (doc as any).lastAutoTable?.finalY || 120;
  doc.setFontSize(13);
  doc.setTextColor(34, 87, 52);
  doc.text(`Total: ${data.totalRevenue.toFixed(2)}`, 14, finalY + 12);

  return doc;
}

export function generateDeliveryNotePDF(data: InvoiceData) {
  const doc = new jsPDF();

  addLogo(doc, data.logoBase64);

  const headerOffset = data.logoBase64 ? 34 : 30;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("DELIVERY NOTE", data.logoBase64 ? 38 : 14, headerOffset);

  doc.setFontSize(11);
  doc.setTextColor(40);
  const infoY = headerOffset + 12;
  doc.text(`Client: ${data.clientName}`, 14, infoY);
  doc.text(`Delivery Date: ${data.deliveryDate}`, 14, infoY + 7);

  if (data.isSupermarket) {
    autoTable(doc, {
      startY: infoY + 14,
      head: [["Product", "Pkg Size", "Pckgs", "Base Cost", "Total Base Cost"]],
      body: data.items.map((i) => [
        i.product,
        i.packageSize ? `${i.packageSize}kg` : i.unit,
        i.numPackages ? i.numPackages.toString() : i.qty.toString(),
        (i.baseCost ?? 0).toFixed(2),
        (i.totalBaseCost ?? 0).toFixed(2),
      ]),
      theme: "striped",
      headStyles: { fillColor: [34, 87, 52] },
    });
  } else {
    autoTable(doc, {
      startY: infoY + 14,
      head: [["Product", "Qty", "Unit", "Base Cost", "Total Base Cost"]],
      body: data.items.map((i) => [
        i.product,
        i.qty.toString(),
        i.unit,
        (i.baseCost ?? 0).toFixed(2),
        (i.totalBaseCost ?? 0).toFixed(2),
      ]),
      theme: "striped",
      headStyles: { fillColor: [34, 87, 52] },
    });
  }

  const finalY = (doc as any).lastAutoTable?.finalY || 120;
  const totalFarmerCost = data.items.reduce((s, i) => s + (i.totalBaseCost ?? 0), 0);
  doc.setFontSize(13);
  doc.setTextColor(34, 87, 52);
  doc.text(`Total Farmer Cost: ${totalFarmerCost.toFixed(2)}`, 14, finalY + 12);

  return doc;
}

// Preload the logo as base64 for PDF embedding
export async function loadLogoBase64(): Promise<string | undefined> {
  try {
    const response = await fetch("/logo.jpg");
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}
