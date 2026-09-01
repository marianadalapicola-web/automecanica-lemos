import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getQuote } from "@/lib/api/quotes";
import {
  COLORS,
  PAGE,
  drawInstitutionalHeader,
  drawKeyValueGrid,
  drawSectionLabel,
  drawTitleBand,
  drawTotalsBox,
  finalizeFooterOnAllPages,
  money,
  dateBr,
  outputPdf,
  resolveSettings,
  type PdfMode,
} from "@/pdf/shared";

export async function generateQuotePdf(quoteId: string, mode: PdfMode) {
  const [quote, settings] = await Promise.all([getQuote(quoteId), resolveSettings()]);
  if (!quote) throw new Error("Cotação não encontrada.");

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { startY } = await drawInstitutionalHeader(doc, settings);

  let y = drawTitleBand(
    doc,
    startY,
    "COTAÇÃO DE PEÇAS E SERVIÇOS",
    [`Nº ${quote.numero}`, `Data: ${dateBr(quote.data)}`, `Validade: ${dateBr(quote.validade)}`],
    "black"
  );

  y = drawSectionLabel(doc, y, "Dados do Cliente");
  y = drawKeyValueGrid(
    doc,
    y,
    [
      { label: "Nome / Razão Social", value: quote.client?.nome || "-" },
      { label: "CPF / CNPJ", value: quote.client?.documento || "-" },
      { label: "Telefone", value: quote.client?.telefone || "-" },
      { label: "WhatsApp", value: quote.client?.whatsapp || "-" },
      { label: "E-mail", value: quote.client?.email || "-" },
      { label: "Responsável", value: quote.responsavel || "-" },
    ],
    3
  );

  y = drawSectionLabel(doc, y + 2, "Dados do Veículo");
  y = drawKeyValueGrid(
    doc,
    y,
    [
      { label: "Placa", value: quote.vehicle?.placa || "-" },
      { label: "Marca / Modelo", value: quote.vehicle ? `${quote.vehicle.marca} ${quote.vehicle.modelo}` : "-" },
      { label: "Ano", value: quote.vehicle?.ano || "-" },
      { label: "Quilometragem", value: quote.vehicle?.km != null ? `${quote.vehicle.km} km` : "-" },
    ],
    4
  );

  y = drawSectionLabel(doc, y + 2, "Itens Cotados");

  const rows = (quote.items || []).map((item) => {
    const fornecedor =
      (item as unknown as { fornecedor_nome: string | null }).fornecedor_nome ||
      item.supplier_options?.find((o) => o.selecionado)?.supplier?.nome ||
      "-";
    return [
      item.codigo || "-",
      item.descricao,
      item.tipo === "peca" ? "Peça" : "Serviço",
      item.marca || "-",
      fornecedor,
      `${item.quantidade}`,
      item.unidade,
      money(item.valor_unitario),
      money(item.desconto),
      money(item.total),
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: PAGE.margin, right: PAGE.margin },
    head: [["Código", "Descrição", "Tipo", "Marca", "Fornecedor", "Qtd.", "Un.", "Vlr. Unitário", "Desconto", "Total"]],
    body: rows,
    styles: { font: "helvetica", fontSize: 7.6, cellPadding: 2.2, textColor: COLORS.black },
    headStyles: { fillColor: COLORS.red, textColor: COLORS.white, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [249, 249, 250] },
    columnStyles: {
      0: { cellWidth: 14 },
      2: { cellWidth: 14 },
      3: { cellWidth: 18 },
      4: { cellWidth: 24 },
      5: { cellWidth: 11, halign: "right" },
      6: { cellWidth: 10, halign: "center" },
      7: { cellWidth: 22, halign: "right" },
      8: { cellWidth: 18, halign: "right" },
      9: { cellWidth: 20, halign: "right", fontStyle: "bold" },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  if (y > PAGE.height - 75) {
    doc.addPage();
    y = PAGE.margin;
  }

  y = drawTotalsBox(doc, y, [
    { label: "Subtotal", value: money(quote.subtotal) },
    { label: "Desconto", value: `- ${money(quote.desconto)}` },
    { label: "VALOR TOTAL", value: money(quote.total), emphasis: true },
  ]);

  y = drawSectionLabel(doc, y, "Condições Comerciais");
  y = drawKeyValueGrid(
    doc,
    y,
    [
      { label: "Forma de Pagamento", value: quote.forma_pagamento || "A combinar" },
      { label: "Prazo de Entrega", value: quote.prazo_entrega || "A combinar" },
      { label: "Validade da Proposta", value: dateBr(quote.validade) },
    ],
    3
  );

  if (quote.observacoes) {
    y = drawSectionLabel(doc, y + 2, "Observações");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.black);
    doc.text(doc.splitTextToSize(quote.observacoes, PAGE.width - PAGE.margin * 2), PAGE.margin, y);
  }

  finalizeFooterOnAllPages(doc, settings);
  outputPdf(doc, `Cotacao-${quote.numero}.pdf`, mode);
}
