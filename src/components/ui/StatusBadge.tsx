import type { QuoteStatus, NoteStatus } from "@/types/database";

const QUOTE_STYLES: Record<QuoteStatus, string> = {
  rascunho: "bg-neutral-100 text-neutral-600",
  enviada: "bg-blue-50 text-blue-700",
  aprovada: "bg-green-50 text-green-700",
  recusada: "bg-red-50 text-red-700",
  expirada: "bg-amber-50 text-amber-700",
};

const QUOTE_LABELS: Record<QuoteStatus, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aprovada: "Aprovada",
  recusada: "Recusada",
  expirada: "Expirada",
};

const NOTE_STYLES: Record<NoteStatus, string> = {
  aberta: "bg-blue-50 text-blue-700",
  paga: "bg-green-50 text-green-700",
  cancelada: "bg-red-50 text-red-700",
};

const NOTE_LABELS: Record<NoteStatus, string> = {
  aberta: "Aberta",
  paga: "Paga",
  cancelada: "Cancelada",
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span className={`badge ${QUOTE_STYLES[status]}`}>
      {QUOTE_LABELS[status]}
    </span>
  );
}

export function NoteStatusBadge({ status }: { status: NoteStatus }) {
  return (
    <span className={`badge ${NOTE_STYLES[status]}`}>
      {NOTE_LABELS[status]}
    </span>
  );
}
