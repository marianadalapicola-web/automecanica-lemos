import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { FullPageSpinner } from "@/components/ui/Misc";
import { TotalsSummary } from "@/components/ui/TotalsSummary";
import { QuoteStatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getQuote, updateQuoteStatus, duplicateQuote } from "@/lib/api/quotes";
import { convertQuoteToNote } from "@/lib/api/notes";
import type { Quote } from "@/types/database";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/contexts/ToastContext";
import { generateQuotePdf } from "@/pdf/quotePdf";
import {
  ArrowLeft,
  Pencil,
  Copy,
  Eye,
  FileDown,
  Printer,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  Loader2,
  FileText,
} from "@/components/icons";

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { push } = useToast();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    "aprovar" | "recusar" | "converter" | null
  >(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      setQuote(await getQuote(id));
    } catch (err) {
      push(err instanceof Error ? err.message : "Erro ao carregar cotação.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleApprove() {
    if (!quote) return;
    setBusy("aprovar");
    try {
      await updateQuoteStatus(quote.id, "aprovada");
      push("Cotação aprovada.");
      setConfirmAction(null);
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Erro ao aprovar cotação.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function handleReject() {
    if (!quote) return;
    setBusy("recusar");
    try {
      await updateQuoteStatus(quote.id, "recusada");
      push("Cotação recusada.");
      setConfirmAction(null);
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Erro ao recusar cotação.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function handleConvert() {
    if (!quote) return;
    setBusy("converter");
    try {
      const note = await convertQuoteToNote(quote.id);
      push(`Nota ${note.numero} gerada a partir da cotação ${quote.numero}.`);
      setConfirmAction(null);
      navigate(`/notas/${note.id}`);
    } catch (err) {
      push(
        err instanceof Error ? err.message : "Erro ao converter cotação em nota.",
        "error"
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleDuplicate() {
    if (!quote) return;
    setBusy("duplicar");
    try {
      const created = await duplicateQuote(quote.id);
      push("Cotação duplicada com sucesso.");
      navigate(`/cotacoes/${created.id}`);
    } catch (err) {
      push(err instanceof Error ? err.message : "Erro ao duplicar cotação.", "error");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <FullPageSpinner />;
  if (!quote)
    return <div className="text-center text-neutral-500">Cotação não encontrada.</div>;

  return (
    <div>
      <button
        onClick={() => navigate("/cotacoes")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-brand-black"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Cotações
      </button>

      <PageHeader
        title={quote.numero}
        subtitle={`Criada em ${formatDate(quote.created_at)}`}
        actions={
          <>
            <Link to={`/cotacoes/${quote.id}/editar`} className="btn-secondary">
              <Pencil className="h-4 w-4" /> Editar
            </Link>
            <button className="btn-secondary" onClick={handleDuplicate} disabled={busy === "duplicar"}>
              {busy === "duplicar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              Duplicar
            </button>
            <button className="btn-secondary" onClick={() => generateQuotePdf(quote.id, "view")}>
              <Eye className="h-4 w-4" /> Visualizar PDF
            </button>
            <button className="btn-secondary" onClick={() => generateQuotePdf(quote.id, "download")}>
              <FileDown className="h-4 w-4" /> Gerar PDF
            </button>
            <button className="btn-dark" onClick={() => generateQuotePdf(quote.id, "print")}>
              <Printer className="h-4 w-4" /> Imprimir
            </button>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <QuoteStatusBadge status={quote.status} />
        {quote.converted_note_id && (
          <Link
            to={`/notas/${quote.converted_note_id}`}
            className="badge bg-neutral-900 text-white hover:bg-neutral-700"
          >
            <FileText className="h-3 w-3" /> Convertida em Nota
          </Link>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {quote.status !== "aprovada" && quote.status !== "recusada" && (
            <>
              <button
                className="btn-primary btn-sm"
                onClick={() => setConfirmAction("aprovar")}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar Cotação
              </button>
              <button
                className="btn-danger btn-sm"
                onClick={() => setConfirmAction("recusar")}
              >
                <XCircle className="h-3.5 w-3.5" /> Recusar Cotação
              </button>
            </>
          )}
          {quote.status === "aprovada" && !quote.converted_note_id && (
            <button
              className="btn-primary btn-sm"
              onClick={() => setConfirmAction("converter")}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" /> Converter em Nota
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoBox label="Cliente" value={quote.client?.nome} />
        <InfoBox
          label="Veículo"
          value={quote.vehicle ? `${quote.vehicle.placa} — ${quote.vehicle.marca} ${quote.vehicle.modelo}` : "Não informado"}
        />
        <InfoBox label="Data" value={formatDate(quote.data)} />
        <InfoBox label="Validade" value={formatDate(quote.validade)} />
        <InfoBox label="Responsável" value={quote.responsavel || "Não informado"} />
        <InfoBox label="Forma de Pagamento" value={quote.forma_pagamento || "Não informado"} />
        <InfoBox label="Prazo de Entrega" value={quote.prazo_entrega || "Não informado"} />
        <InfoBox label="Observações" value={quote.observacoes || "Nenhuma"} />
      </div>

      <div className="card mb-6 overflow-hidden">
        <div className="border-b border-neutral-100 px-5 py-3">
          <h3 className="section-title">Itens</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descrição</th>
                <th>Tipo</th>
                <th>Marca</th>
                <th>Fornecedor</th>
                <th>Qtd.</th>
                <th>Vlr. Unit.</th>
                <th>Desconto</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(quote.items || []).map((item) => (
                <tr key={item.id}>
                  <td>{item.codigo || "-"}</td>
                  <td className="font-medium text-brand-black">{item.descricao}</td>
                  <td className="capitalize">{item.tipo === "peca" ? "Peça" : "Serviço"}</td>
                  <td>{item.marca || "-"}</td>
                  <td>
                    {(item as unknown as { fornecedor_nome: string | null }).fornecedor_nome ||
                      item.supplier_options?.find((o) => o.selecionado)?.supplier?.nome ||
                      "-"}
                  </td>
                  <td>
                    {item.quantidade} {item.unidade}
                  </td>
                  <td>{formatCurrency(item.valor_unitario)}</td>
                  <td>{formatCurrency(item.desconto)}</td>
                  <td className="font-bold text-brand-black">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <TotalsSummary subtotal={quote.subtotal} desconto={quote.desconto} total={quote.total} />
      </div>

      <ConfirmDialog
        open={confirmAction === "aprovar"}
        title="Aprovar cotação"
        message="Confirma a aprovação desta cotação? Após aprovada, ela poderá ser convertida em nota fiscal."
        confirmLabel="Aprovar"
        danger={false}
        loading={busy === "aprovar"}
        onConfirm={handleApprove}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === "recusar"}
        title="Recusar cotação"
        message="Confirma a recusa desta cotação?"
        confirmLabel="Recusar"
        loading={busy === "recusar"}
        onConfirm={handleReject}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === "converter"}
        title="Converter em nota fiscal"
        message="Será criada uma nova nota fiscal com os dados desta cotação (cliente, veículo, itens, quantidades e valores). A cotação original será preservada."
        confirmLabel="Converter"
        danger={false}
        loading={busy === "converter"}
        onConfirm={handleConvert}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-brand-black">
        {value || "-"}
      </p>
    </div>
  );
}
