import { FormEvent, useState } from "react";
import type { Supplier } from "@/types/database";
import { maskDocumento, maskPhone } from "@/lib/format";
import { Loader2 } from "@/components/icons";

export interface SupplierFormValues {
  nome: string;
  cnpj: string;
  telefone: string;
  whatsapp: string;
  email: string;
  contato: string;
  observacoes: string;
}

export function SupplierForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Salvar Fornecedor",
}: {
  initial?: Partial<Supplier>;
  onSubmit: (values: SupplierFormValues) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<SupplierFormValues>({
    nome: initial?.nome || "",
    cnpj: initial?.cnpj || "",
    telefone: initial?.telefone || "",
    whatsapp: initial?.whatsapp || "",
    email: initial?.email || "",
    contato: initial?.contato || "",
    observacoes: initial?.observacoes || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof SupplierFormValues>(key: K, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values.nome.trim()) {
      setError("Informe o nome/razão social do fornecedor.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar fornecedor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="field">
        <label className="label">Nome / Razão Social *</label>
        <input
          className="input"
          value={values.nome}
          onChange={(e) => set("nome", e.target.value)}
          required
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="field">
          <label className="label">CNPJ</label>
          <input
            className="input"
            value={values.cnpj}
            onChange={(e) => set("cnpj", maskDocumento(e.target.value))}
          />
        </div>
        <div className="field">
          <label className="label">Contato (responsável)</label>
          <input
            className="input"
            value={values.contato}
            onChange={(e) => set("contato", e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">Telefone</label>
          <input
            className="input"
            value={values.telefone}
            onChange={(e) => set("telefone", maskPhone(e.target.value))}
          />
        </div>
        <div className="field">
          <label className="label">WhatsApp</label>
          <input
            className="input"
            value={values.whatsapp}
            onChange={(e) => set("whatsapp", maskPhone(e.target.value))}
          />
        </div>
        <div className="field sm:col-span-2">
          <label className="label">E-mail</label>
          <input
            type="email"
            className="input"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
      </div>
      <div className="field">
        <label className="label">Observações</label>
        <textarea
          className="input"
          rows={2}
          value={values.observacoes}
          onChange={(e) => set("observacoes", e.target.value)}
        />
      </div>

      {error && <p className="text-sm font-medium text-brand-red">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
