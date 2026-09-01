import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard, FullPageSpinner } from "@/components/ui/Misc";
import { loadReportData, type ReportData } from "@/lib/api/reports";
import { formatCurrency, todayISO } from "@/lib/format";
import { useToast } from "@/contexts/ToastContext";
import { FileText, DollarSign, ClipboardList, CheckCircle2, XCircle } from "@/components/icons";

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aprovada: "Aprovada",
  recusada: "Recusada",
  expirada: "Expirada",
};

const STATUS_COLORS: Record<string, string> = {
  rascunho: "#a1a1aa",
  enviada: "#3b82f6",
  aprovada: "#16a34a",
  recusada: "#e11d2e",
  expirada: "#f59e0b",
};

function firstDayOfMonth(monthsAgo: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsAgo);
  return d.toISOString().slice(0, 10);
}

export default function Reports() {
  const [startDate, setStartDate] = useState(firstDayOfMonth(5));
  const [endDate, setEndDate] = useState(todayISO());
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const { push } = useToast();

  async function load() {
    setLoading(true);
    try {
      setData(await loadReportData({ startDate, endDate }));
    } catch (err) {
      push(err instanceof Error ? err.message : "Erro ao carregar relatórios.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader title="Relatórios" subtitle="Análise de notas e cotações por período" />

      <div className="card mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
        <div className="field">
          <label className="label">Data Inicial</label>
          <input
            type="date"
            className="input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">Data Final</label>
          <input
            type="date"
            className="input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <button className="btn-primary" onClick={load}>
          Aplicar Filtro
        </button>
      </div>

      {loading || !data ? (
        <FullPageSpinner />
      ) : (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Total de Notas" value={data.totalNotes} icon={FileText} tone="dark" />
            <StatCard
              label="Valor das Notas"
              value={formatCurrency(data.totalNotesValue)}
              icon={DollarSign}
              tone="red"
            />
            <StatCard label="Total de Cotações" value={data.totalQuotes} icon={ClipboardList} />
            <StatCard label="Cotações Aprovadas" value={data.approvedQuotes} icon={CheckCircle2} tone="red" />
            <StatCard label="Cotações Recusadas" value={data.rejectedQuotes} icon={XCircle} tone="dark" />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="card p-5 xl:col-span-2">
              <h3 className="section-title mb-4">Valores por Período</h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eceef0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6e6e74" }} axisLine={{ stroke: "#eceef0" }} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#6e6e74" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `R$ ${Number(v) / 1000}k`}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ borderRadius: 12, border: "1px solid #eceef0" }}
                    />
                    <Legend />
                    <Bar dataKey="notas" name="Notas" fill="#0a0a0a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cotacoes" name="Cotações" fill="#e11d2e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="section-title mb-4">Cotações por Status</h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.statusBreakdown.filter((s) => s.count > 0)}
                      dataKey="count"
                      nameKey="status"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {data.statusBreakdown
                        .filter((s) => s.count > 0)
                        .map((s) => (
                          <Cell key={s.status} fill={STATUS_COLORS[s.status]} />
                        ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, _name, entry) => [
                        value,
                        STATUS_LABELS[(entry?.payload as { status: string })?.status] || "",
                      ]}
                      contentStyle={{ borderRadius: 12, border: "1px solid #eceef0" }}
                    />
                    <Legend
                      formatter={(value: string) => STATUS_LABELS[value] || value}
                      wrapperStyle={{ fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
