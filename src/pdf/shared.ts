import { jsPDF } from "jspdf";
import { getSettings } from "@/lib/api/settings";
import type { Settings } from "@/types/database";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

export const PAGE = {
  width: 210,
  height: 297,
  margin: 14,
};

export const COLORS = {
  red: [225, 29, 46] as [number, number, number],
  redDark: [153, 20, 31] as [number, number, number],
  black: [10, 10, 10] as [number, number, number],
  gray: [110, 110, 116] as [number, number, number],
  lightGray: [237, 237, 239] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

export type PdfMode = "view" | "download" | "print";

export async function resolveSettings(): Promise<Settings> {
  try {
    return await getSettings();
  } catch {
    return {
      id: "singleton" as unknown as Settings["id"],
      nome_oficina: "AUTOMECÂNICA LEMOS",
      razao_social: null,
      cnpj: null,
      telefone: null,
      whatsapp: null,
      email: null,
      endereco: null,
      cep: null,
      cidade: null,
      estado: null,
      logo_url: null,
    };
  }
}

async function loadLogoDataUrl(logoUrl: string | null): Promise<string | null> {
  if (!logoUrl) return null;
  if (logoUrl.startsWith("data:")) return logoUrl;
  try {
    const res = await fetch(logoUrl, { mode: "cors" });
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export interface HeaderResult {
  startY: number;
}

/**
 * Cabeçalho institucional comum aos dois documentos: logo (ou selo tipográfico
 * de fallback), nome da oficina e dados de contato/endereço.
 */
export async function drawInstitutionalHeader(
  doc: jsPDF,
  settings: Settings
): Promise<HeaderResult> {
  const { margin, width } = PAGE;
  let y = margin;

  const logoData = await loadLogoDataUrl(settings.logo_url);
  const logoSize = 18;

  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", margin, y, logoSize, logoSize, undefined, "FAST");
    } catch {
      drawLogoSeal(doc, margin, y, logoSize);
    }
  } else {
    drawLogoSeal(doc, margin, y, logoSize);
  }

  const textX = margin + logoSize + 5;
  doc.setTextColor(...COLORS.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(settings.nome_oficina || "AUTOMECÂNICA LEMOS", textX, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.gray);
  const contactParts = [
    settings.razao_social,
    settings.cnpj ? `CNPJ: ${settings.cnpj}` : null,
  ].filter(Boolean);
  if (contactParts.length) {
    doc.text(contactParts.join("  •  "), textX, y + 11.5);
  }

  const contact2 = [
    settings.telefone ? `Tel: ${settings.telefone}` : null,
    settings.whatsapp ? `WhatsApp: ${settings.whatsapp}` : null,
    settings.email || null,
  ].filter(Boolean);
  if (contact2.length) {
    doc.text(contact2.join("  •  "), textX, y + 16);
  }

  const addressParts = [
    settings.endereco,
    settings.cidade && settings.estado ? `${settings.cidade} - ${settings.estado}` : settings.cidade,
    settings.cep,
  ].filter(Boolean);
  if (addressParts.length) {
    doc.text(addressParts.join("  •  "), textX, y + 20.5);
  }

  // Right side: disclaimer badge
  doc.setFontSize(6.8);
  doc.setTextColor(...COLORS.gray);
  doc.text(
    "Documento sem valor fiscal — não representa emissão oficial pela SEFAZ.",
    width - margin,
    y + 4,
    { align: "right" }
  );

  y += logoSize + 6;
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.6);
  doc.line(margin, y, width - margin, y);
  doc.setDrawColor(...COLORS.red);
  doc.setLineWidth(1.1);
  doc.line(margin, y + 0.9, width - margin, y + 0.9);

  return { startY: y + 6 };
}

function drawLogoSeal(doc: jsPDF, x: number, y: number, size: number) {
  doc.setFillColor(...COLORS.black);
  doc.roundedRect(x, y, size, size, 2.5, 2.5, "F");
  doc.setFillColor(...COLORS.red);
  doc.roundedRect(x + size - 8, y + size - 8, 8, 8, 1.5, 1.5, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("AL", x + size / 2, y + size / 2 + 1.5, { align: "center", baseline: "middle" });
}

export function drawTitleBand(
  doc: jsPDF,
  y: number,
  title: string,
  rightLines: string[],
  style: "red" | "black" = "red"
): number {
  const { margin, width } = PAGE;
  const bandHeight = 15;
  const bg = style === "red" ? COLORS.red : COLORS.black;

  doc.setFillColor(...bg);
  doc.rect(margin, y, width - margin * 2, bandHeight, "F");
  if (style === "black") {
    doc.setFillColor(...COLORS.red);
    doc.rect(margin, y, 2, bandHeight, "F");
  }

  doc.setTextColor(...COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.text(title, margin + (style === "black" ? 6 : 4), y + bandHeight / 2 + 1.3, {
    baseline: "middle",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  rightLines.forEach((line, idx) => {
    const totalLines = rightLines.length;
    const lineY =
      y + bandHeight / 2 + 1.3 - ((totalLines - 1) * 3.6) / 2 + idx * 3.6;
    doc.text(line, width - margin - 4, lineY, { align: "right", baseline: "middle" });
  });

  return y + bandHeight + 8;
}

export function drawSectionLabel(doc: jsPDF, y: number, label: string): number {
  const { margin } = PAGE;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.red);
  doc.text(label.toUpperCase(), margin, y);
  doc.setDrawColor(...COLORS.lightGray);
  doc.setLineWidth(0.3);
  doc.line(margin, y + 1.5, PAGE.width - margin, y + 1.5);
  return y + 6;
}

export function drawKeyValueGrid(
  doc: jsPDF,
  y: number,
  entries: { label: string; value: string }[],
  columns = 2
): number {
  const { margin, width } = PAGE;
  const colWidth = (width - margin * 2) / columns;
  const rowHeight = 9.5;
  let maxY = y;

  entries.forEach((entry, idx) => {
    const col = idx % columns;
    const row = Math.floor(idx / columns);
    const x = margin + col * colWidth;
    const rowY = y + row * rowHeight;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.gray);
    doc.text(entry.label.toUpperCase(), x, rowY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.black);
    const value = entry.value || "-";
    doc.text(doc.splitTextToSize(value, colWidth - 4), x, rowY + 4.5);

    maxY = Math.max(maxY, rowY + rowHeight);
  });

  return maxY + 2;
}

export function drawTotalsBox(
  doc: jsPDF,
  y: number,
  rows: { label: string; value: string; emphasis?: boolean }[]
): number {
  const { margin, width } = PAGE;
  const boxWidth = 72;
  const x = width - margin - boxWidth;
  const rowHeight = 6.5;
  const padding = 4;
  const boxHeight = rows.length * rowHeight + padding * 2;

  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(x, y, boxWidth, boxHeight, 1.5, 1.5, "F");

  let rowY = y + padding + 3.5;
  rows.forEach((row) => {
    if (row.emphasis) {
      doc.setDrawColor(200, 200, 205);
      doc.setLineWidth(0.2);
      doc.line(x + padding, rowY - 5, x + boxWidth - padding, rowY - 5);
    }
    doc.setFont("helvetica", row.emphasis ? "bold" : "normal");
    doc.setFontSize(row.emphasis ? 11 : 8.5);
    doc.setTextColor(...(row.emphasis ? COLORS.red : COLORS.gray));
    doc.text(row.label, x + padding, rowY);
    doc.setTextColor(...(row.emphasis ? COLORS.red : COLORS.black));
    doc.text(row.value, x + boxWidth - padding, rowY, { align: "right" });
    rowY += rowHeight;
  });

  return y + boxHeight + 6;
}

export function finalizeFooterOnAllPages(doc: jsPDF, settings: Settings) {
  const pageCount = doc.getNumberOfPages();
  const { margin, width, height } = PAGE;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footerY = height - 12;

    doc.setDrawColor(...COLORS.lightGray);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 4, width - margin, footerY - 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.gray);
    const oficinaLine = [
      settings.nome_oficina,
      settings.cnpj ? `CNPJ ${settings.cnpj}` : null,
      settings.telefone,
    ]
      .filter(Boolean)
      .join("  •  ");
    doc.text(oficinaLine, margin, footerY);
    doc.text("Documento gerado pelo sistema.", margin, footerY + 4);

    doc.text(`Página ${i} de ${pageCount}`, width - margin, footerY, {
      align: "right",
    });
    doc.text(formatDateTime(new Date().toISOString()), width - margin, footerY + 4, {
      align: "right",
    });
  }
}

export function outputPdf(doc: jsPDF, filename: string, mode: PdfMode) {
  if (mode === "download") {
    doc.save(filename);
    return;
  }
  const blobUrl = doc.output("bloburl");
  const win = window.open(blobUrl.toString(), "_blank");
  if (mode === "print" && win) {
    win.addEventListener("load", () => {
      win.focus();
      win.print();
    });
  }
}

export function money(v: number) {
  return formatCurrency(v);
}

export function dateBr(v: string | null | undefined) {
  return formatDate(v);
}
