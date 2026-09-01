import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput, EmptyState, FullPageSpinner } from "@/components/ui/Misc";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ClientForm, ClientFormValues } from "@/components/forms/ClientForm";
import {
  createClient,
  deleteClient,
  listClients,
  updateClient,
} from "@/lib/api/clients";
import type { Client } from "@/types/database";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Pencil, Trash2, ChevronRight, Users } from "@/components/icons";

export default function ClientsList() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const { push } = useToast();
  const { isAdmin } = useAuth();

  async function load() {
    setLoading(true);
    try {
      const data = await listClients(search || undefined);
      setClients(data);
    } catch (err) {
      push(err instanceof Error ? err.message : "Erro ao carregar clientes.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleSave(values: ClientFormValues) {
    if (editing) {
      await updateClient(editing.id, values);
      push("Cliente atualizado com sucesso.");
    } else {
      await createClient(values);
      push("Cliente cadastrado com sucesso.");
    }
    setModalOpen(false);
    setEditing(null);
    await load();
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await deleteClient(deleting.id);
      push("Cliente excluído.");
      setDeleting(null);
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Erro ao excluir cliente.", "error");
    } finally {
      setDeletingBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Cadastro de clientes da oficina"
        actions={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nome, CPF/CNPJ ou e-mail"
            />
            <button
              className="btn-primary"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Novo Cliente
            </button>
          </>
        }
      />

      {loading ? (
        <FullPageSpinner />
      ) : clients.length === 0 ? (
        <EmptyState
          title="Nenhum cliente cadastrado"
          message="Cadastre o primeiro cliente para começar a criar notas e cotações."
          action={
            <button className="btn-primary" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" /> Novo Cliente
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
                  <th>CPF/CNPJ</th>
                  <th>Telefone</th>
                  <th>E-mail</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td className="font-semibold text-brand-black">
                      <Link
                        to={`/clientes/${c.id}`}
                        className="flex items-center gap-1.5 hover:text-brand-red"
                      >
                        <Users className="h-3.5 w-3.5 text-neutral-400" />
                        {c.nome}
                      </Link>
                    </td>
                    <td>{c.documento || "-"}</td>
                    <td>{c.telefone || "-"}</td>
                    <td>{c.email || "-"}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Link
                          to={`/clientes/${c.id}`}
                          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-brand-black"
                          title="Ver detalhes"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                        <button
                          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-brand-black"
                          onClick={() => {
                            setEditing(c);
                            setModalOpen(true);
                          }}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {isAdmin && (
                          <button
                            className="rounded-lg p-2 text-neutral-500 hover:bg-red-50 hover:text-brand-red"
                            onClick={() => setDeleting(c)}
                            title="Excluir"
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
        title={editing ? "Editar Cliente" : "Novo Cliente"}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
      >
        <ClientForm
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
        title="Excluir cliente"
        message={`Tem certeza que deseja excluir "${deleting?.nome}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deletingBusy}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
