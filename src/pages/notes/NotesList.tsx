import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput, EmptyState, FullPageSpinner } from "@/components/ui/Misc";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { NoteStatusBadge } from "@/components/ui/StatusBadge";
import { deleteNote, listNotes } from "@/lib/api/notes";
import type { Note } from "@/types/database";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Eye, Pencil, FileDown, Trash2 } from "@/components/icons";
import { generateNotePdf } from "@/pdf/notePdf";

export default function NotesList() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<Note | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const { push } = useToast();
  const { isAdmin } = useAuth();

  async function load() {
    setLoading(true);
    try {
      const data = await listNotes(search || undefined);
      setNotes(data);
    } catch (err) {
      push(err instanceof Error ? err.message : "Erro ao carregar notas.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const filtered = notes.filter((n) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      n.numero.toLowerCase().includes(term) ||
      n.client?.nome.toLowerCase().includes(term) ||
      n.client?.documento?.toLowerCase().includes(term) ||
      n.vehicle?.placa?.toLowerCase().includes(term)
    );
  });

  async function handleDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await deleteNote(deleting.id);
      push("Nota excluída.");
      setDeleting(null);
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Erro ao excluir nota.", "error");
    } finally {
      setDeletingBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Notas Fiscais"
        subtitle="Consulta de notas fiscais emitidas"
        actions={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por NF, cliente, CPF/CNPJ ou placa"
            />
            <Link to="/notas/nova" className="btn-primary">
              <Plus className="h-4 w-4" /> Nova Nota
            </Link>
          </>
        }
      />

      {loading ? (
        <FullPageSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma nota encontrada"
          action={
            <Link to="/notas/nova" className="btn-primary">
              <Plus className="h-4 w-4" /> Nova Nota
            </Link>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>NF</th>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Veículo</th>
                  <th>Placa</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((n) => (
                  <tr key={n.id}>
                    <td className="font-semibold text-brand-black">
                      <Link to={`/notas/${n.id}`} className="hover:text-brand-red">
                        {n.numero}
                      </Link>
                    </td>
                    <td>{formatDate(n.data)}</td>
                    <td>{n.client?.nome || "-"}</td>
                    <td>{n.vehicle ? `${n.vehicle.marca} ${n.vehicle.modelo}` : "-"}</td>
                    <td>{n.vehicle?.placa || "-"}</td>
                    <td className="font-semibold">{formatCurrency(n.total)}</td>
                    <td>
                      <NoteStatusBadge status={n.status} />
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Link
                          to={`/notas/${n.id}`}
                          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-brand-black"
                          title="Visualizar"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link
                          to={`/notas/${n.id}/editar`}
                          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-brand-black"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-brand-black"
                          title="Gerar PDF"
                          onClick={() => generateNotePdf(n.id, "download")}
                        >
                          <FileDown className="h-4 w-4" />
                        </button>
                        {isAdmin && (
                          <button
                            className="rounded-lg p-2 text-neutral-500 hover:bg-red-50 hover:text-brand-red"
                            title="Excluir"
                            onClick={() => setDeleting(n)}
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
        title="Excluir nota"
        message={`Tem certeza que deseja excluir a nota "${deleting?.numero}"?`}
        confirmLabel="Excluir"
        loading={deletingBusy}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
