export interface CalculableItem {
  quantidade: number;
  valor_unitario: number;
  desconto: number;
}

export function itemTotal(item: CalculableItem): number {
  const bruto = (item.quantidade || 0) * (item.valor_unitario || 0);
  const total = bruto - (item.desconto || 0);
  return Math.max(0, round2(total));
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calcTotals(items: CalculableItem[]) {
  const subtotal = round2(
    items.reduce((sum, i) => sum + (i.quantidade || 0) * (i.valor_unitario || 0), 0)
  );
  const desconto = round2(items.reduce((sum, i) => sum + (i.desconto || 0), 0));
  const total = Math.max(0, round2(subtotal - desconto));
  return { subtotal, desconto, total };
}

export function noteBalance(total: number, valorPago: number): number {
  return Math.max(0, round2((total || 0) - (valorPago || 0)));
}
