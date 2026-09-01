import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { listSuppliers } from "@/lib/api/suppliers";
import type { Supplier } from "@/types/database";
import { formatCurrency, parseCurrencyInput } from "@/lib/format";
import type { SupplierOptionDraft } from "@/lib/api/quotes";
import { Plus, Trash2, Check, Star } from "@/components/icons";

export function SupplierComparisonModal({
  open,
  itemLabel,
  options,
  onClose,
  onSave,
}: {
  open: boolean;
  itemLabel: string;
  options: SupplierOptionDraft[];
  onClose: () => void;
  onSave: (options: SupplierOptionDraft[]) => void;
}) {
  const [rows, setRows] = useState<SupplierOptionDraft[]>(options);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    if (open) {
      setRows(options.length > 0 ? options : []);
      listSuppliers()
        .then(setSuppliers)
        .catch(() => setSuppliers([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        supplier_id: null,
        supplier_nome_livre: "",
        preco: 0,
        selecionado: prev.length === 0,
      },
    ]);
  }

  function updateRow(idx: number, patch: Partial<SupplierOptionDraft>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function removeRow(idx: number) {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length > 0 && !next.some((r) => r.selecionado)) {
        next[0] = { ...next[0], selecionado: true };
      }
      return next;
    });
  }

  function selectRow(idx: number) {
    setRows((prev) => prev.map((r, i) => ({ ...r, selecionado: i === idx })));
  }

  function handleSave() {
    onSave(rows);
    onClose();
  }

  const cheapestPrice =
    rows.length > 0 ? Math.min(...rows.map((r) => r.preco || Infinity)) : null;

  return (
    <Modal open={open} title="Comparação de Fornecedores" onClose={onClose} width="max-w-2xl">
      <p className="mb-4 text-sm text-neutral-500">
        Item: <span className="font-semibold text-brand-black">{itemLabel || "(sem descrição)"}</span>
      </p>

      <div className="space-y-3">
        {rows.length === 0 && (
          <p className="rounded-lg border border-dashed border-neutral-300 py-6 text-center text-sm text-neutral-400">
            Nenhum fornecedor cadastrado para este item ainda.
          </p>
        )}
        {rows.map((row, idx) => (
          <div
            key={idx}
            className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center ${
              row.selecionado
                ? "border-brand-red bg-red-50/50"
                : "border-neutral-200 bg-white"
            }`}
          >
            <div className="flex-1">
              <label className="label">Fornecedor</label>
              <select
                className="input"
                value={row.supplier_id || ""}
                onChange={(e) => {
                  const supplier = suppliers.find((s) => s.id === e.target.value);
                  updateRow(idx, {
                    supplier_id: e.target.value || null,
                    supplier_nome_livre: supplier ? supplier.nome : row.supplier_nome_livre,
                  });
                }}
              >
                <option value="">Outro (digitar nome)</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
              {!row.supplier_id && (
                <input
                  className="input mt-2"
                  placeholder="Nome do fornecedor"
                  value={row.supplier_nome_livre || ""}
                  onChange={(e) =>
                    updateRow(idx, { supplier_nome_livre: e.target.value })
                  }
                />
              )}
            </div>
            <div className="w-full sm:w-40">
              <label className="label">Preço</label>
              <input
                className="input"
                value={row.preco === 0 ? "" : formatCurrency(row.preco)}
                placeholder="R$ 0,00"
                onChange={(e) =>
                  updateRow(idx, { preco: parseCurrencyInput(e.target.value) })
                }
              />
            </div>
            <div className="flex items-center gap-2 sm:mt-5">
              <button
                type="button"
                onClick={() => selectRow(idx)}
                className={
                  row.selecionado
                    ? "btn-primary btn-sm"
                    : "btn-secondary btn-sm"
                }
                title="Selecionar esta opção"
              >
                {row.selecionado ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Selecionado
                  </>
                ) : (
                  "Selecionar"
                )}
              </button>
              {cheapestPrice !== null && row.preco === cheapestPrice && rows.length > 1 && (
                <span
                  title="Menor preço"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-600"
                >
                  <Star className="h-3.5 w-3.5" />
                </span>
              )}
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-brand-red"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addRow} className="btn-secondary btn-sm mt-3">
        <Plus className="h-3.5 w-3.5" /> Adicionar Fornecedor
      </button>

      <div className="mt-6 flex justify-end gap-2 border-t border-neutral-100 pt-4">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="btn-primary" onClick={handleSave}>
          Usar opção selecionada
        </button>
      </div>
    </Modal>
  );
}
