import { FormEvent, useState } from "react";
import type { Vehicle } from "@/types/database";
import { maskPlaca } from "@/lib/format";
import { Loader2 } from "@/components/icons";
import { ClientPicker } from "@/components/pickers/ClientPicker";

export interface VehicleFormValues {
  client_id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: string;
  cor: string;
  km: string;
  observacoes: string;
}

export function VehicleForm({
  initial,
  fixedClientId,
  onSubmit,
  onCancel,
  submitLabel = "Salvar Veículo",
}: {
  initial?: Partial<Vehicle>;
  fixedClientId?: string;
  onSubmit: (values: VehicleFormValues) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<VehicleFormValues>({
    client_id: fixedClientId || initial?.client_id || "",
    placa: initial?.placa || "",
    marca: initial?.marca || "",
    modelo: initial?.modelo || "",
    ano: initial?.ano || "",
    cor: initial?.cor || "",
    km: initial?.km != null ? String(initial.km) : "",
    observacoes: initial?.observacoes || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof VehicleFormValues>(key: K, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values.client_id) {
      setError("Selecione o cliente proprietário do veículo.");
      return;
    }
    if (!values.placa.trim()) {
      setError("Informe a placa do veículo.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar veículo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!fixedClientId && (
        <div className="field">
          <label className="label">Cliente *</label>
          <ClientPicker
            value={values.client_id}
            onChange={(id) => set("client_id", id)}
          />
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="field">
          <label className="label">Placa *</label>
          <input
            className="input uppercase"
            value={values.placa}
            onChange={(e) => set("placa", maskPlaca(e.target.value))}
            required
          />
        </div>
        <div className="field">
          <label className="label">Ano</label>
          <input
            className="input"
            value={values.ano}
            onChange={(e) => set("ano", e.target.value)}
            placeholder="2024"
          />
        </div>
        <div className="field">
          <label className="label">Marca</label>
          <input
            className="input"
            value={values.marca}
            onChange={(e) => set("marca", e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">Modelo</label>
          <input
            className="input"
            value={values.modelo}
            onChange={(e) => set("modelo", e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">Cor</label>
          <input
            className="input"
            value={values.cor}
            onChange={(e) => set("cor", e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">Quilometragem</label>
          <input
            type="number"
            min="0"
            className="input"
            value={values.km}
            onChange={(e) => set("km", e.target.value)}
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
