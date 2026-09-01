import { supabase } from "@/lib/supabaseClient";
import type { QuoteStatus } from "@/types/database";

export interface ReportFilters {
  startDate: string;
  endDate: string;
}

export interface MonthlyPoint {
  month: string;
  notas: number;
  cotacoes: number;
}

export interface ReportData {
  totalNotes: number;
  totalNotesValue: number;
  totalQuotes: number;
  approvedQuotes: number;
  rejectedQuotes: number;
  totalQuotesValue: number;
  monthly: MonthlyPoint[];
  statusBreakdown: { status: QuoteStatus; count: number }[];
}

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export async function loadReportData(filters: ReportFilters): Promise<ReportData> {
  const [notesRes, quotesRes] = await Promise.all([
    supabase
      .from("notes")
      .select("id, data, total")
      .gte("data", filters.startDate)
      .lte("data", filters.endDate),
    supabase
      .from("quotes")
      .select("id, data, total, status")
      .gte("data", filters.startDate)
      .lte("data", filters.endDate),
  ]);

  const notes = notesRes.data || [];
  const quotes = quotesRes.data || [];

  const totalNotesValue = notes.reduce((sum, n) => sum + (n.total || 0), 0);
  const totalQuotesValue = quotes.reduce((sum, q) => sum + (q.total || 0), 0);
  const approvedQuotes = quotes.filter((q) => q.status === "aprovada").length;
  const rejectedQuotes = quotes.filter((q) => q.status === "recusada").length;

  const monthMap = new Map<string, MonthlyPoint>();
  function bucketKey(dateStr: string) {
    const d = new Date(`${dateStr}T00:00:00`);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  function ensureBucket(key: string) {
    if (!monthMap.has(key)) {
      const [, m] = key.split("-");
      monthMap.set(key, { month: MONTH_LABELS[Number(m) - 1], notas: 0, cotacoes: 0 });
    }
    return monthMap.get(key)!;
  }
  notes.forEach((n) => {
    const bucket = ensureBucket(bucketKey(n.data));
    bucket.notas += n.total || 0;
  });
  quotes.forEach((q) => {
    const bucket = ensureBucket(bucketKey(q.data));
    bucket.cotacoes += q.total || 0;
  });

  const sortedKeys = Array.from(monthMap.keys()).sort();
  const monthly = sortedKeys.map((k) => monthMap.get(k)!);

  const statusOrder: QuoteStatus[] = ["rascunho", "enviada", "aprovada", "recusada", "expirada"];
  const statusBreakdown = statusOrder.map((status) => ({
    status,
    count: quotes.filter((q) => q.status === status).length,
  }));

  return {
    totalNotes: notes.length,
    totalNotesValue,
    totalQuotes: quotes.length,
    approvedQuotes,
    rejectedQuotes,
    totalQuotesValue,
    monthly,
    statusBreakdown,
  };
}
