import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard, FullPageSpinner } from "@/components/ui/Misc";
import { QuoteStatusBadge } from "@/components/ui/StatusBadge";
import { loadDashboardStats, type DashboardStats } from "@/lib/api/dashboard";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/contexts/ToastContext";
import { generateNotePdf } from "@/pdf/notePdf";
import { generateQuotePdf } from "@/pdf/quotePdf";
import {
  FileText,
  DollarSign,
  ClipboardList,
  Clock,
  CheckCircle2,
  Users,
  Car,
  Plus,
  Eye,
  FileDown,
} from "@/components/icons";

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { push } = useToast();

  useEffect(() => {
    loadDashboardStats()
      .then(setStats)
      .catch((err) =>
        push(err instanceof Error ? err.message : "Erro ao carregar dashboard.", "error")
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !stats) return <FullPageSpinner />;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral da Automecânica Lemos"
        actions={
          <>
            <Link to="/notas/nova" className="btn-primary">
              <Plus className="h-4 w-4" /> Nova Nota
            </Link>
            <Link to="/cotacoes/novo" className="btn-dark">
              <Plus className="h-4 w-4" /> Nova Cotação
            </Link>
          </>
        }
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total de Notas" value={stats.totalNotes} icon={FileText} tone="dark" />
        <StatCard
          label="Valor das Notas"
          value={formatCurrency(stats.totalNotesValue)}
          icon={DollarSign}
          tone="red"
        />
        <StatCard label="Total de Cotações" value={stats.totalQuotes} icon={ClipboardList} />
        <StatCard label="Cotações em Aberto" value={stats.openQuotes} icon={Clock} />
        <StatCard label="Cotações Aprovadas" value={stats.approvedQuotes} icon={CheckCircle2} tone="red" />
        <StatCard label="Total de Clientes" value={stats.totalClients} icon={Users} tone="dark" />
        <StatCard label="Total de Veículos" value={stats.totalVehicles} icon={Car} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3.5">
            <h3 className="section-title">Últimas Notas</h3>
            <Link to="/notas" className="text-xs font-semibold text-brand-red hover:underline">
              Ver todas
            </Link>
          </div>
          {stats.latestNotes.length === 0 ? (
            <p className="p-6 text-center text-sm text-neutral-500">
              Nenhuma nota cadastrada ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Data</th>
                    <th>Cliente</th>
                    <th>Veículo</th>
                    <th>Valor</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.latestNotes.map((n) => (
                    <tr key={n.id}>
                      <td className="font-semibold text-brand-black">{n.numero}</td>
                      <td>{formatDate(n.data)}</td>
                      <td className="max-w-[120px] truncate">{n.client?.nome || "-"}</td>
                      <td>{n.vehicle?.placa || "-"}</td>
                      <td className="font-semibold">{formatCurrency(n.total)}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <Link
                            to={`/notas/${n.id}`}
                            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-brand-black"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <button
                            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-brand-black"
                            onClick={() => generateNotePdf(n.id, "download")}
                          >
                            <FileDown className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3.5">
            <h3 className="section-title">Últimas Cotações</h3>
            <Link to="/cotacoes" className="text-xs font-semibold text-brand-red hover:underline">
              Ver todas
            </Link>
          </div>
          {stats.latestQuotes.length === 0 ? (
            <p className="p-6 text-center text-sm text-neutral-500">
              Nenhuma cotação cadastrada ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Data</th>
                    <th>Cliente</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.latestQuotes.map((q) => (
                    <tr key={q.id}>
                      <td className="font-semibold text-brand-black">{q.numero}</td>
                      <td>{formatDate(q.data)}</td>
                      <td className="max-w-[120px] truncate">{q.client?.nome || "-"}</td>
                      <td className="font-semibold">{formatCurrency(q.total)}</td>
                      <td>
                        <QuoteStatusBadge status={q.status} />
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <Link
                            to={`/cotacoes/${q.id}`}
                            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-brand-black"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <button
                            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-brand-black"
                            onClick={() => generateQuotePdf(q.id, "download")}
                          >
                            <FileDown className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
