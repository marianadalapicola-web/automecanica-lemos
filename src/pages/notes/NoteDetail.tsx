import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { FullPageSpinner } from "@/components/ui/Misc";
import { TotalsSummary } from "@/components/ui/TotalsSummary";
import { NoteStatusBadge } from "@/components/ui/StatusBadge";
import { getNote } from "@/lib/api/notes";
import type { Note } from "@/types/database";
import { formatCurrency, formatDate } from "@/lib/format";
import { noteBalance } from "@/lib/calc";
import { useToast } from "@/contexts/ToastContext";
import { generateNotePdf } from "@/pdf/notePdf";
import {
  ArrowLeft,
  Pencil,
  Eye,
  FileDown,
  Printer,
  ClipboardList,
} from "@/components/icons";

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { push } = useToast();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getNote(id)
      .then(setNote)
      .catch((err) =>
        push(err instanceof Error ? err.message : "Erro ao carregar nota.", "error")
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <FullPageSpinner />;
  if (!note)
    return <div className="text-center text-neutral-500">Nota não encontrada.</div>;

  const saldo = noteBalance(note.total, note.valor_pago);

  return (
    <div>
      <button
        onClick={() => navigate("/notas")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-brand-black"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Notas Fiscais
      </button>

      <PageHeader
        title={`NF ${note.numero} / ${note.serie}`}
        subtitle={`Emitida em ${formatDate(note.data)}`}
        actions={
          <>
            <Link to={`/notas/${note.id}/editar`} className="btn-secondary">
              <Pencil className="h-4 w-4" /> Editar
            </Link>
            <button className="btn-secondary" onClick={() => generateNotePdf(note.id, "view")}>
              <Eye className="h-4 w-4" /> Visualizar PDF
            </button>
            <button className="btn-secondary" onClick={() => generateNotePdf(note.id, "download")}>
              <FileDown className="h-4 w-4" /> Gerar PDF
            </button>
            <button className="btn-dark" onClick={() => generateNotePdf(note.id, "print")}>
              <Printer className="h-4 w-4" /> Imprimir
            </button>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <NoteStatusBadge status={note.status} />
        {note.origin_quote_id && (
          <Link
            to={`/cotacoes/${note.origin_quote_id}`}
            className="badge bg-neutral-900 text-white hover:bg-neutral-700"
          >
            <ClipboardList className="h-3 w-3" /> Originada de Cotação
          </Link>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoBox label="Cliente" value={note.client?.nome} />
        <InfoBox
          label="Veículo"
          value={note.vehicle ? `${note.vehicle.placa} — ${note.vehicle.marca} ${note.vehicle.modelo}` : "Não informado"}
        />
        <InfoBox label="Chave de Acesso" value={note.chave_acesso || "Não informado"} />
        <InfoBox label="Forma de Pagamento" value={note.forma_pagamento || "Não informado"} />
        <InfoBox label="Condição" value={note.condicao_pagamento || "Não informado"} />
        <InfoBox label="Parcelas" value={String(note.parcelas ?? 1)} />
        <InfoBox label="Valor Pago" value={formatCurrency(note.valor_pago)} />
        <InfoBox label="Observações" value={note.observacoes || "Nenhuma"} />
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
                <th>Qtd.</th>
                <th>Vlr. Unit.</th>
                <th>Desconto</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(note.items || []).map((item) => (
                <tr key={item.id}>
                  <td>{item.codigo || "-"}</td>
                  <td className="font-medium text-brand-black">{item.descricao}</td>
                  <td className="capitalize">{item.tipo === "peca" ? "Peça" : "Serviço"}</td>
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
        <TotalsSummary
          subtotal={note.subtotal}
          desconto={note.desconto}
          total={note.total}
          extraRows={[
            { label: "Valor Pago", value: formatCurrency(note.valor_pago) },
            { label: "Saldo", value: formatCurrency(saldo) },
          ]}
        />
      </div>
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
