import type { ReactNode } from "react";
import type { NoteItemDraft } from "@/lib/api/notes";
import { itemTotal } from "@/lib/calc";
import { formatCurrency, parseCurrencyInput } from "@/lib/format";
import { Plus, Trash2 } from "@/components/icons";

function emptyItem(): NoteItemDraft {
  return {
    codigo: "",
    descricao: "",
    tipo: "peca",
    quantidade: 1,
    unidade: "un",
    valor_unitario: 0,
    desconto: 0,
  };
}

export function NoteItemsTable({
  items,
  onChange,
}: {
  items: NoteItemDraft[];
  onChange: (items: NoteItemDraft[]) => void;
}) {
  function updateItem(idx: number, patch: Partial<NoteItemDraft>) {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function addItem() {
    onChange([...items, emptyItem()]);
  }

  function removeItem(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <Th>Código</Th>
              <Th className="min-w-[240px]">Descrição</Th>
              <Th>Tipo</Th>
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
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-neutral-400">
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
