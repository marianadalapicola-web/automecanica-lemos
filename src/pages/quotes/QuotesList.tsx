import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput, EmptyState, FullPageSpinner } from "@/components/ui/Misc";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { QuoteStatusBadge } from "@/components/ui/StatusBadge";
import { deleteQuote, duplicateQuote, listQuotes } from "@/lib/api/quotes";
import type { Quote, QuoteStatus } from "@/types/database";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Eye, Pencil, Copy, FileDown, Trash2 } from "@/components/icons";
import { generateQuotePdf } from "@/pdf/quotePdf";

const STATUS_FILTERS: { value: QuoteStatus | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "rascunho", label: "Rascunho" },
  { value: "enviada", label: "Enviada" },
  { value: "aprovada", label: "Aprovada" },
  { value: "recusada", label: "Recusada" },
  { value: "expirada", label: "Expirada" },
];

export default function QuotesList() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "todos">("todos");
  const [deleting, setDeleting] = useState<Quote | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const { push } = useToast();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const data = await listQuotes(search || undefined);
      setQuotes(data);
    } catch (err) {
      push(err instanceof Error ? err.message : "Erro ao carregar cotações.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const filtered = quotes.filter(
    (q) => statusFilter === "todos" || q.status === statusFilter
  );

  async function handleDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await deleteQuote(deleting.id);
      push("Cotação excluída.");
      setDeleting(null);
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Erro ao excluir cotação.", "error");
    } finally {
      setDeletingBusy(false);
    }
  }

  async function handleDuplicate(id: string) {
    setDuplicatingId(id);
    try {
      const created = await duplicateQuote(id);
      push("Cotação duplicada com sucesso.");
      navigate(`/cotacoes/${created.id}`);
    } catch (err) {
      push(err instanceof Error ? err.message : "Erro ao duplicar cotação.", "error");
    } finally {
      setDuplicatingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Cotações"
        subtitle="Cotações de peças e serviços"
        actions={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por número"
            />
            <Link to="/cotacoes/novo" className="btn-primary">
              <Plus className="h-4 w-4" /> Nova Cotação
            </Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === f.value
                ? "border-brand-red bg-brand-red text-white"
                : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <FullPageSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma cotação encontrada"
          action={
            <Link to="/cotacoes/novo" className="btn-primary">
              <Plus className="h-4 w-4" /> Nova Cotação
            </Link>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Cotação</th>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Veículo</th>
                  <th>Valor</th>
                  <th>Validade</th>
                  <th>Status</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((q) => (
                  <tr key={q.id}>
                    <td className="font-semibold text-brand-black">
                      <Link to={`/cotacoes/${q.id}`} className="hover:text-brand-red">
                        {q.numero}
                      </Link>
                    </td>
                    <td>{formatDate(q.data)}</td>
                    <td>{q.client?.nome || "-"}</td>
                    <td>{q.vehicle ? q.vehicle.placa : "-"}</td>
                    <td className="font-semibold">{formatCurrency(q.total)}</td>
                    <td>{formatDate(q.validade)}</td>
                    <td>
                      <QuoteStatusBadge status={q.status} />
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Link
                          to={`/cotacoes/${q.id}`}
                          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-brand-black"
                          title="Visualizar"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link
                          to={`/cotacoes/${q.id}/editar`}
                          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-brand-black"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-brand-black disabled:opacity-40"
                          title="Duplicar"
                          disabled={duplicatingId === q.id}
                          onClick={() => handleDuplicate(q.id)}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-brand-black"
                          title="Gerar PDF"
                          onClick={() => generateQuotePdf(q.id, "download")}
                        >
                          <FileDown className="h-4 w-4" />
                        </button>
                        {isAdmin && (
                          <button
                            className="rounded-lg p-2 text-neutral-500 hover:bg-red-50 hover:text-brand-red"
                            title="Excluir"
                            onClick={() => setDeleting(q)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Excluir cotação"
        message={`Tem certeza que deseja excluir a cotação "${deleting?.numero}"?`}
        confirmLabel="Excluir"
        loading={deletingBusy}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
