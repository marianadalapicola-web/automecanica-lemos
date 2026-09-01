import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { FullPageSpinner } from "@/components/ui/Misc";
import { Modal } from "@/components/ui/Modal";
import { ClientForm, ClientFormValues } from "@/components/forms/ClientForm";
import { getClient, updateClient } from "@/lib/api/clients";
import { listVehiclesByClient } from "@/lib/api/vehicles";
import { listNotesByClient } from "@/lib/api/notes";
import { listQuotesByClient } from "@/lib/api/quotes";
import type { Client, Note, Quote, Vehicle } from "@/types/database";
import { formatCurrency, formatDate } from "@/lib/format";
import { QuoteStatusBadge, NoteStatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/contexts/ToastContext";
import {
  ArrowLeft,
  Pencil,
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  Car,
  FileText,
  ClipboardList,
  Plus,
} from "@/components/icons";

type Tab = "veiculos" | "notas" | "cotacoes";

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { push } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("veiculos");
  const [editOpen, setEditOpen] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const [c, v, n, q] = await Promise.all([
        getClient(id),
        listVehiclesByClient(id),
        listNotesByClient(id),
        listQuotesByClient(id),
      ]);
      setClient(c);
      setVehicles(v);
      setNotes(n);
      setQuotes(q);
    } catch (err) {
      push(err instanceof Error ? err.message : "Erro ao carregar cliente.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSave(values: ClientFormValues) {
    if (!id) return;
    await updateClient(id, values);
    push("Cliente atualizado com sucesso.");
    setEditOpen(false);
    await load();
  }

  if (loading) return <FullPageSpinner />;
  if (!client)
    return (
      <div className="text-center text-neutral-500">Cliente não encontrado.</div>
    );

  return (
    <div>
      <button
        onClick={() => navigate("/clientes")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-brand-black"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Clientes
      </button>

      <PageHeader
        title={client.nome}
        subtitle={client.documento || "Documento não informado"}
        actions={
          <button className="btn-secondary" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Editar
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoTile icon={Phone} label="Telefone" value={client.telefone} />
        <InfoTile icon={MessageCircle} label="WhatsApp" value={client.whatsapp} />
        <InfoTile icon={Mail} label="E-mail" value={client.email} />
        <InfoTile icon={MapPin} label="Endereço" value={client.endereco} />
      </div>

      <div className="mb-4 flex gap-1 border-b border-neutral-200">
        <TabButton active={tab === "veiculos"} onClick={() => setTab("veiculos")} icon={Car}>
          Veículos ({vehicles.length})
        </TabButton>
        <TabButton active={tab === "notas"} onClick={() => setTab("notas")} icon={FileText}>
          Notas ({notes.length})
        </TabButton>
        <TabButton
          active={tab === "cotacoes"}
          onClick={() => setTab("cotacoes")}
          icon={ClipboardList}
        >
          Cotações ({quotes.length})
        </TabButton>
      </div>

      {tab === "veiculos" && (
        <div className="card overflow-hidden">
          {vehicles.length === 0 ? (
            <p className="p-8 text-center text-sm text-neutral-500">
              Nenhum veículo cadastrado para este cliente.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Placa</th>
                    <th>Marca/Modelo</th>
                    <th>Ano</th>
                    <th>Cor</th>
                    <th>KM</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => (
                    <tr key={v.id}>
                      <td className="font-semibold text-brand-black">
                        <Link to={`/veiculos/${v.id}`} className="hover:text-brand-red">
                          {v.placa}
                        </Link>
                      </td>
                      <td>
                        {v.marca} {v.modelo}
                      </td>
                      <td>{v.ano || "-"}</td>
                      <td>{v.cor || "-"}</td>
                      <td>{v.km ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t border-neutral-100 p-4">
            <Link
              to={`/veiculos?novo=1&client_id=${client.id}`}
              className="btn-secondary btn-sm"
            >
              <Plus className="h-3.5 w-3.5" /> Novo Veículo
            </Link>
          </div>
        </div>
      )}

      {tab === "notas" && (
        <div className="card overflow-hidden">
          {notes.length === 0 ? (
            <p className="p-8 text-center text-sm text-neutral-500">
              Nenhuma nota fiscal para este cliente.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>NF</th>
                    <th>Data</th>
                    <th>Valor</th>
                    <th>Status</th>
                  </tr>
                </thead>
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
      )}

      {tab === "cotacoes" && (
        <div className="card overflow-hidden">
          {quotes.length === 0 ? (
            <p className="p-8 text-center text-sm text-neutral-500">
              Nenhuma cotação para este cliente.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Cotação</th>
                    <th>Data</th>
                    <th>Valor</th>
                    <th>Status</th>
                  </tr>
                </thead>
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
      )}

      <Modal open={editOpen} title="Editar Cliente" onClose={() => setEditOpen(false)}>
        <ClientForm
          initial={client}
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
  icon: typeof Phone;
  label: string;
  value: string | null;
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
        <p className="truncate text-sm font-medium text-brand-black">
          {value || "Não informado"}
        </p>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Car;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
        active
          ? "border-brand-red text-brand-red"
          : "border-transparent text-neutral-500 hover:text-brand-black"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
