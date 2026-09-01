import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput, EmptyState, FullPageSpinner } from "@/components/ui/Misc";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SupplierForm, SupplierFormValues } from "@/components/forms/SupplierForm";
import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  updateSupplier,
} from "@/lib/api/suppliers";
import type { Supplier } from "@/types/database";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Pencil, Trash2, Truck } from "@/components/icons";

export default function SuppliersList() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const { push } = useToast();
  const { isAdmin } = useAuth();

  async function load() {
    setLoading(true);
    try {
      const data = await listSuppliers(search || undefined);
      setSuppliers(data);
    } catch (err) {
      push(err instanceof Error ? err.message : "Erro ao carregar fornecedores.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleSave(values: SupplierFormValues) {
    if (editing) {
      await updateSupplier(editing.id, values);
      push("Fornecedor atualizado com sucesso.");
    } else {
      await createSupplier(values);
      push("Fornecedor cadastrado com sucesso.");
    }
    setModalOpen(false);
    setEditing(null);
    await load();
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await deleteSupplier(deleting.id);
      push("Fornecedor excluído.");
      setDeleting(null);
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Erro ao excluir fornecedor.", "error");
    } finally {
      setDeletingBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Fornecedores"
        subtitle="Cadastro de fornecedores de peças e serviços"
        actions={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nome ou CNPJ"
            />
            <button
              className="btn-primary"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Novo Fornecedor
            </button>
          </>
        }
      />

      {loading ? (
        <FullPageSpinner />
      ) : suppliers.length === 0 ? (
        <EmptyState
          title="Nenhum fornecedor cadastrado"
          action={
            <button className="btn-primary" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" /> Novo Fornecedor
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Nome / Razão Social</th>
                  <th>CNPJ</th>
                  <th>Contato</th>
                  <th>Telefone</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="flex items-center gap-1.5 font-semibold text-brand-black">
                      <Truck className="h-3.5 w-3.5 text-neutral-400" />
                      {s.nome}
                    </td>
                    <td>{s.cnpj || "-"}</td>
                    <td>{s.contato || "-"}</td>
                    <td>{s.telefone || "-"}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button
                          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-brand-black"
                          onClick={() => {
                            setEditing(s);
                            setModalOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {isAdmin && (
                          <button
                            className="rounded-lg p-2 text-neutral-500 hover:bg-red-50 hover:text-brand-red"
                            onClick={() => setDeleting(s)}
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

      <Modal
        open={modalOpen}
        title={editing ? "Editar Fornecedor" : "Novo Fornecedor"}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
      >
        <SupplierForm
          initial={editing ?? undefined}
          onSubmit={handleSave}
          onCancel={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Excluir fornecedor"
        message={`Tem certeza que deseja excluir "${deleting?.nome}"?`}
        confirmLabel="Excluir"
        loading={deletingBusy}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
