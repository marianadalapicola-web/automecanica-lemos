import { useState, type ReactNode } from "react";
import type { QuoteItemDraft, SupplierOptionDraft } from "@/lib/api/quotes";
import { nextQuoteItem } from "@/lib/api/quotes";
import { itemTotal } from "@/lib/calc";
import { formatCurrency, parseCurrencyInput } from "@/lib/format";
import { SupplierComparisonModal } from "@/components/quotes/SupplierComparisonModal";
import { Plus, Trash2, Truck } from "@/components/icons";

export function QuoteItemsTable({
  items,
  onChange,
}: {
  items: QuoteItemDraft[];
  onChange: (items: QuoteItemDraft[]) => void;
}) {
  const [comparisonIdx, setComparisonIdx] = useState<number | null>(null);

  function updateItem(idx: number, patch: Partial<QuoteItemDraft>) {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function addItem() {
    onChange([...items, nextQuoteItem()]);
  }

  function removeItem(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  function applySupplierOptions(idx: number, options: SupplierOptionDraft[]) {
    const selected = options.find((o) => o.selecionado);
    updateItem(idx, {
      supplier_options: options,
      valor_unitario: selected ? selected.preco : items[idx].valor_unitario,
      fornecedor_id: selected?.supplier_id ?? null,
      fornecedor_nome: selected ? selected.supplier_nome_livre : items[idx].fornecedor_nome,
    });
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <Th>Código</Th>
              <Th className="min-w-[220px]">Descrição</Th>
              <Th>Tipo</Th>
              <Th>Marca</Th>
              <Th className="min-w-[160px]">Fornecedor</Th>
              <Th className="w-20">Qtd.</Th>
              <Th className="w-20">Un.</Th>
              <Th className="w-32">Vlr. Unitário</Th>
              <Th className="w-28">Desconto</Th>
              <Th className="w-32">Total</Th>
              <Th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-neutral-100 last:border-0">
                <Td>
                  <input
                    className="cell-input"
                    value={item.codigo}
                    onChange={(e) => updateItem(idx, { codigo: e.target.value })}
                  />
                </Td>
                <Td>
                  <input
                    className="cell-input"
                    value={item.descricao}
                    onChange={(e) => updateItem(idx, { descricao: e.target.value })}
                    placeholder="Descrição da peça ou serviço"
                  />
                </Td>
                <Td>
                  <select
                    className="cell-input"
                    value={item.tipo}
                    onChange={(e) =>
                      updateItem(idx, { tipo: e.target.value as "peca" | "servico" })
                    }
                  >
                    <option value="peca">Peça</option>
                    <option value="servico">Serviço</option>
                  </select>
                </Td>
                <Td>
                  <input
                    className="cell-input"
                    value={item.marca}
                    onChange={(e) => updateItem(idx, { marca: e.target.value })}
                  />
                </Td>
                <Td>
                  <button
                    type="button"
                    onClick={() => setComparisonIdx(idx)}
                    className="flex w-full items-center gap-1.5 rounded-lg border border-neutral-200 px-2 py-1.5 text-left text-xs font-medium text-neutral-600 hover:border-brand-red hover:text-brand-red"
                  >
                    <Truck className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {item.fornecedor_nome ||
                        (item.supplier_options.find((o) => o.selecionado)
                          ? "Selecionado"
                          : "Comparar")}
                    </span>
                  </button>
                </Td>
                <Td>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="cell-input text-right"
                    value={item.quantidade}
                    onChange={(e) =>
                      updateItem(idx, { quantidade: Number(e.target.value) || 0 })
                    }
                  />
                </Td>
                <Td>
                  <input
                    className="cell-input text-center"
                    value={item.unidade}
                    onChange={(e) => updateItem(idx, { unidade: e.target.value })}
                  />
                </Td>
                <Td>
                  <input
                    className="cell-input text-right"
                    value={item.valor_unitario === 0 ? "" : formatCurrency(item.valor_unitario)}
                    placeholder="R$ 0,00"
                    onChange={(e) =>
                      updateItem(idx, { valor_unitario: parseCurrencyInput(e.target.value) })
                    }
                  />
                </Td>
                <Td>
                  <input
                    className="cell-input text-right"
                    value={item.desconto === 0 ? "" : formatCurrency(item.desconto)}
                    placeholder="R$ 0,00"
                    onChange={(e) =>
                      updateItem(idx, { desconto: parseCurrencyInput(e.target.value) })
                    }
                  />
                </Td>
                <Td>
                  <span className="block px-2 py-1.5 text-right text-sm font-bold text-brand-black">
                    {formatCurrency(itemTotal(item))}
                  </span>
                </Td>
                <Td>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-brand-red"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </Td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-sm text-neutral-400">
                  Nenhum item adicionado. Clique em "Adicionar Item" para começar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button type="button" onClick={addItem} className="btn-secondary btn-sm mt-3">
        <Plus className="h-3.5 w-3.5" /> Adicionar Item
      </button>

      {comparisonIdx !== null && (
        <SupplierComparisonModal
          open={comparisonIdx !== null}
          itemLabel={items[comparisonIdx]?.descricao || ""}
          options={items[comparisonIdx]?.supplier_options || []}
          onClose={() => setComparisonIdx(null)}
          onSave={(options) => applySupplierOptions(comparisonIdx, options)}
        />
      )}
    </div>
  );
}

function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-neutral-500 ${className}`}>
      {children}
    </th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-1.5 py-1.5 align-middle">{children}</td>;
}
