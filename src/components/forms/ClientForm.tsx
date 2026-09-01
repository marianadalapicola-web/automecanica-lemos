import { FormEvent, useState } from "react";
import type { Client } from "@/types/database";
import { maskDocumento, maskPhone } from "@/lib/format";
import { Loader2 } from "@/components/icons";

export interface ClientFormValues {
  nome: string;
  documento: string;
  telefone: string;
  whatsapp: string;
  email: string;
  endereco: string;
}

export function ClientForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Salvar Cliente",
}: {
  initial?: Partial<Client>;
  onSubmit: (values: ClientFormValues) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<ClientFormValues>({
    nome: initial?.nome || "",
    documento: initial?.documento || "",
    telefone: initial?.telefone || "",
    whatsapp: initial?.whatsapp || "",
    email: initial?.email || "",
    endereco: initial?.endereco || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ClientFormValues>(key: K, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values.nome.trim()) {
      setError("Informe o nome/razão social.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar cliente.");
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
          <label className="label">CPF / CNPJ</label>
          <input
            className="input"
            value={values.documento}
            onChange={(e) => set("documento", maskDocumento(e.target.value))}
          />
        </div>
        <div className="field">
          <label className="label">E-mail</label>
          <input
            type="email"
            className="input"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
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
      </div>
      <div className="field">
        <label className="label">Endereço</label>
        <input
          className="input"
          value={values.endereco}
          onChange={(e) => set("endereco", e.target.value)}
          placeholder="Rua, número, bairro, cidade - UF"
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
