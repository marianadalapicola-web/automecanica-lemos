import { ReactNode } from "react";
import { Loader2, Search } from "@/components/icons";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  icon: typeof Search;
  tone?: "default" | "red" | "dark";
}) {
  const toneStyles: Record<string, string> = {
    default: "bg-neutral-100 text-neutral-600",
    red: "bg-brand-red/10 text-brand-red",
    dark: "bg-brand-black/10 text-brand-black",
  };
  return (
    <div className="card flex items-center gap-4 p-5">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneStyles[tone]}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {label}
        </p>
        <p className="mt-0.5 truncate text-xl font-extrabold text-brand-black">
          {value}
        </p>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white/50 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
        <Search className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-bold text-brand-black">{title}</p>
        {message && <p className="mt-1 text-sm text-neutral-500">{message}</p>}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ className = "h-6 w-6" }: { className?: string }) {
  return <Loader2 className={`animate-spin text-brand-red ${className}`} />;
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Pesquisar..."}
        className="input pl-9"
      />
    </div>
  );
}
