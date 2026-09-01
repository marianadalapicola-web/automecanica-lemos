import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { FullPageSpinner } from "@/components/ui/Misc";
import { Modal } from "@/components/ui/Modal";
import { VehicleForm, VehicleFormValues } from "@/components/forms/VehicleForm";
import { getVehicle, updateVehicle } from "@/lib/api/vehicles";
import { listNotesByVehicle } from "@/lib/api/notes";
import { listQuotesByVehicle } from "@/lib/api/quotes";
import type { Note, Quote, Vehicle } from "@/types/database";
import { formatCurrency, formatDate } from "@/lib/format";
import { QuoteStatusBadge, NoteStatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/contexts/ToastContext";
import {
  ArrowLeft,
  Pencil,
  Gauge,
  Palette,
  Users,
  FileText,
  ClipboardList,
} from "@/components/icons";

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { push } = useToast();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const [v, n, q] = await Promise.all([
        getVehicle(id),
        listNotesByVehicle(id),
        listQuotesByVehicle(id),
      ]);
      setVehicle(v);
      setNotes(n);
      setQuotes(q);
    } catch (err) {
      push(err instanceof Error ? err.message : "Erro ao carregar veículo.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSave(values: VehicleFormValues) {
    if (!id) return;
    await updateVehicle(id, {
      client_id: values.client_id,
      placa: values.placa,
      marca: values.marca,
      modelo: values.modelo,
      ano: values.ano || null,
      cor: values.cor || null,
      km: values.km ? Number(values.km) : null,
      observacoes: values.observacoes || null,
    });
    push("Veículo atualizado com sucesso.");
    setEditOpen(false);
    await load();
  }

  if (loading) return <FullPageSpinner />;
  if (!vehicle)
    return (
      <div className="text-center text-neutral-500">Veículo não encontrado.</div>
    );

  return (
    <div>
      <button
        onClick={() => navigate("/veiculos")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-brand-black"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Veículos
      </button>

      <PageHeader
        title={vehicle.placa}
        subtitle={`${vehicle.marca} ${vehicle.modelo} ${vehicle.ano ? `· ${vehicle.ano}` : ""}`}
        actions={
          <button className="btn-secondary" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Editar
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoTile
          icon={Users}
          label="Cliente"
          value={
            vehicle.client ? (
              <Link to={`/clientes/${vehicle.client.id}`} className="hover:text-brand-red">
                {vehicle.client.nome}
              </Link>
            ) : (
              "-"
            )
          }
        />
        <InfoTile icon={Palette} label="Cor" value={vehicle.cor || "Não informado"} />
        <InfoTile
          icon={Gauge}
          label="Quilometragem"
          value={vehicle.km != null ? `${vehicle.km.toLocaleString("pt-BR")} km` : "Não informado"}
        />
        <InfoTile
          icon={FileText}
          label="Observações"
          value={vehicle.observacoes || "Nenhuma"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-neutral-100 px-5 py-3">
            <FileText className="h-4 w-4 text-neutral-400" />
            <h3 className="section-title">Histórico de Notas</h3>
          </div>
          {notes.length === 0 ? (
            <p className="p-6 text-center text-sm text-neutral-500">
              Nenhuma nota para este veículo.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <tbody>
                  {notes.map((n) => (
                    <tr key={n.id}>
                      <td className="font-semibold text-brand-black">
                        <Link to={`/notas/${n.id}`} className="hover:text-brand-red">
                          {n.numero}
                        </Link>
                      </td>
                      <td>{formatDate(n.data)}</td>
                      <td>{formatCurrency(n.total)}</td>
                      <td>
                        <NoteStatusBadge status={n.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-neutral-100 px-5 py-3">
            <ClipboardList className="h-4 w-4 text-neutral-400" />
            <h3 className="section-title">Histórico de Cotações</h3>
          </div>
          {quotes.length === 0 ? (
            <p className="p-6 text-center text-sm text-neutral-500">
              Nenhuma cotação para este veículo.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <tbody>
                  {quotes.map((q) => (
                    <tr key={q.id}>
                      <td className="font-semibold text-brand-black">
                        <Link to={`/cotacoes/${q.id}`} className="hover:text-brand-red">
                          {q.numero}
                        </Link>
                      </td>
                      <td>{formatDate(q.data)}</td>
                      <td>{formatCurrency(q.total)}</td>
                      <td>
                        <QuoteStatusBadge status={q.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal open={editOpen} title="Editar Veículo" onClose={() => setEditOpen(false)}>
        <VehicleForm
          initial={vehicle}
          onSubmit={handleSave}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>
    </div>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gauge;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="card flex items-start gap-3 p-4">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          {label}
        </p>
        <p className="truncate text-sm font-medium text-brand-black">{value}</p>
      </div>
    </div>
  );
}
