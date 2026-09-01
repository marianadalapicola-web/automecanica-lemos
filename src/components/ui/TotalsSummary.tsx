import { formatCurrency } from "@/lib/format";

export function TotalsSummary({
  subtotal,
  desconto,
  total,
  extraRows,
}: {
  subtotal: number;
  desconto: number;
  total: number;
  extraRows?: { label: string; value: string }[];
}) {
  return (
    <div className="ml-auto w-full max-w-xs space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <Row label="Subtotal" value={formatCurrency(subtotal)} />
      <Row label="Desconto" value={`- ${formatCurrency(desconto)}`} muted />
      {extraRows?.map((r) => (
        <Row key={r.label} label={r.label} value={r.value} muted />
      ))}
      <div className="my-1 h-px bg-neutral-200" />
      <Row label="TOTAL" value={formatCurrency(total)} big />
    </div>
  );
}

function Row({
  label,
  value,
  big,
  muted,
}: {
  label: string;
  value: string;
  big?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={
          big
            ? "text-sm font-bold uppercase tracking-wide text-brand-black"
            : `text-sm ${muted ? "text-neutral-500" : "text-neutral-600"}`
        }
      >
        {label}
      </span>
      <span
        className={
          big ? "text-lg font-extrabold text-brand-red" : "text-sm font-semibold text-brand-black"
        }
      >
        {value}
      </span>
    </div>
  );
}
