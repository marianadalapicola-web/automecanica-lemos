import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput, EmptyState, FullPageSpinner } from "@/components/ui/Misc";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { VehicleForm, VehicleFormValues } from "@/components/forms/VehicleForm";
import {
  createVehicle,
  deleteVehicle,
  listVehicles,
  updateVehicle,
} from "@/lib/api/vehicles";
import type { Vehicle } from "@/types/database";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Pencil, Trash2, ChevronRight, Car } from "@/components/icons";

export default function VehiclesList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(
    searchParams.get("novo") !== null || false
  );
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [deleting, setDeleting] = useState<Vehicle | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const { push } = useToast();
  const { isAdmin } = useAuth();
  const presetClientId = searchParams.get("client_id") || undefined;

  async function load() {
    setLoading(true);
    try {
      const data = await listVehicles(search || undefined);
      setVehicles(data);
    } catch (err) {
      push(err instanceof Error ? err.message : "Erro ao carregar veículos.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    if (searchParams.has("client_id") || searchParams.has("novo")) {
      setSearchParams({});
    }
  }

  async function handleSave(values: VehicleFormValues) {
    const payload = {
      client_id: values.client_id,
      placa: values.placa,
      marca: values.marca,
      modelo: values.modelo,
      ano: values.ano || null,
      cor: values.cor || null,
      km: values.km ? Number(values.km) : null,
      observacoes: values.observacoes || null,
    };
    if (editing) {
      await updateVehicle(editing.id, payload);
      push("Veículo atualizado com sucesso.");
    } else {
      await createVehicle(payload);
      push("Veículo cadastrado com sucesso.");
    }
    closeModal();
    await load();
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await deleteVehicle(deleting.id);
      push("Veículo excluído.");
      setDeleting(null);
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Erro ao excluir veículo.", "error");
    } finally {
      setDeletingBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Veículos"
        subtitle="Cadastro de veículos dos clientes"
        actions={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por placa, marca ou modelo"
            />
            <button className="btn-primary" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" /> Novo Veículo
            </button>
          </>
        }
      />

      {loading ? (
        <FullPageSpinner />
      ) : vehicles.length === 0 ? (
        <EmptyState
          title="Nenhum veículo cadastrado"
          action={
            <button className="btn-primary" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" /> Novo Veículo
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Placa</th>
                  <th>Marca/Modelo</th>
                  <th>Ano</th>
                  <th>Cliente</th>
                  <th>KM</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id}>
                    <td className="font-semibold text-brand-black">
                      <Link
                        to={`/veiculos/${v.id}`}
                        className="flex items-center gap-1.5 hover:text-brand-red"
                      >
                        <Car className="h-3.5 w-3.5 text-neutral-400" />
                        {v.placa}
                      </Link>
                    </td>
                    <td>
                      {v.marca} {v.modelo}
                    </td>
                    <td>{v.ano || "-"}</td>
                    <td>
                      {v.client ? (
                        <Link
                          to={`/clientes/${v.client.id}`}
                          className="hover:text-brand-red"
                        >
                          {v.client.nome}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>{v.km ?? "-"}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Link
                          to={`/veiculos/${v.id}`}
                          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-brand-black"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                        <button
                          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-brand-black"
                          onClick={() => {
                            setEditing(v);
                            setModalOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {isAdmin && (
                          <button
                            className="rounded-lg p-2 text-neutral-500 hover:bg-red-50 hover:text-brand-red"
                            onClick={() => setDeleting(v)}
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
        title={editing ? "Editar Veículo" : "Novo Veículo"}
        onClose={closeModal}
      >
        <VehicleForm
          initial={editing ?? undefined}
          fixedClientId={editing ? undefined : presetClientId}
          onSubmit={handleSave}
          onCancel={closeModal}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Excluir veículo"
        message={`Tem certeza que deseja excluir o veículo "${deleting?.placa}"?`}
        confirmLabel="Excluir"
        loading={deletingBusy}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
