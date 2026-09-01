import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getNote } from "@/lib/api/notes";
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

export async function generateNotePdf(noteId: string, mode: PdfMode) {
  const [note, settings] = await Promise.all([getNote(noteId), resolveSettings()]);
  if (!note) throw new Error("Nota não encontrada.");

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { startY } = await drawInstitutionalHeader(doc, settings);

  let y = drawTitleBand(
    doc,
    startY,
    `NOTA FISCAL Nº ${note.numero} / SÉRIE ${note.serie}`,
    [`Emissão: ${dateBr(note.data)}`, note.chave_acesso ? `Chave: ${note.chave_acesso}` : "Chave: não informada"],
    "red"
  );

  y = drawSectionLabel(doc, y, "Dados do Cliente");
  y = drawKeyValueGrid(
    doc,
    y,
    [
      { label: "Nome / Razão Social", value: note.client?.nome || "-" },
      { label: "CPF / CNPJ", value: note.client?.documento || "-" },
      { label: "Telefone", value: note.client?.telefone || "-" },
      { label: "WhatsApp", value: note.client?.whatsapp || "-" },
      { label: "E-mail", value: note.client?.email || "-" },
      { label: "Endereço", value: note.client?.endereco || "-" },
    ],
    3
  );

  y = drawSectionLabel(doc, y + 2, "Dados do Veículo");
  y = drawKeyValueGrid(
    doc,
    y,
    [
      { label: "Placa", value: note.vehicle?.placa || "-" },
      { label: "Marca / Modelo", value: note.vehicle ? `${note.vehicle.marca} ${note.vehicle.modelo}` : "-" },
      { label: "Ano", value: note.vehicle?.ano || "-" },
      { label: "Quilometragem", value: note.vehicle?.km != null ? `${note.vehicle.km} km` : "-" },
    ],
    4
  );

  y = drawSectionLabel(doc, y + 2, "Itens");

  const rows = (note.items || []).map((item) => [
    item.codigo || "-",
    item.descricao,
    item.tipo === "peca" ? "Peça" : "Serviço",
    `${item.quantidade}`,
    item.unidade,
    money(item.valor_unitario),
    money(item.desconto),
    money(item.total),
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: PAGE.margin, right: PAGE.margin },
    head: [["Código", "Descrição", "Tipo", "Qtd.", "Un.", "Vlr. Unitário", "Desconto", "Total"]],
    body: rows,
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2.4, textColor: COLORS.black },
    headStyles: { fillColor: COLORS.black, textColor: COLORS.white, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [249, 249, 250] },
    columnStyles: {
      0: { cellWidth: 18 },
      2: { cellWidth: 18 },
      3: { cellWidth: 14, halign: "right" },
      4: { cellWidth: 12, halign: "center" },
      5: { cellWidth: 26, halign: "right" },
      6: { cellWidth: 22, halign: "right" },
      7: { cellWidth: 24, halign: "right", fontStyle: "bold" },
    },
    didDrawPage: () => {
      // header repeats visually via section content; footer added globally at the end
    },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  if (y > PAGE.height - 70) {
    doc.addPage();
    y = PAGE.margin;
  }

  const saldo = Math.max(0, note.total - note.valor_pago);
  y = drawTotalsBox(doc, y, [
    { label: "Subtotal", value: money(note.subtotal) },
    { label: "Desconto", value: `- ${money(note.desconto)}` },
    { label: "VALOR TOTAL", value: money(note.total), emphasis: true },
  ]);

  y = drawSectionLabel(doc, y, "Pagamento");
  y = drawKeyValueGrid(
    doc,
    y,
    [
      { label: "Forma de Pagamento", value: note.forma_pagamento || "-" },
      { label: "Condição", value: note.condicao_pagamento || "-" },
      { label: "Parcelas", value: String(note.parcelas ?? 1) },
      { label: "Valor Pago", value: money(note.valor_pago) },
      { label: "Saldo", value: money(saldo) },
    ],
    3
  );

  if (note.observacoes) {
    y = drawSectionLabel(doc, y + 2, "Observações");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.black);
    doc.text(doc.splitTextToSize(note.observacoes, PAGE.width - PAGE.margin * 2), PAGE.margin, y);
  }

  finalizeFooterOnAllPages(doc, settings);
  outputPdf(doc, `NF-${note.numero}-${note.serie}.pdf`, mode);
}
