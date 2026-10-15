import type { AppData, Category, Settings } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-salario', name: 'Salário', kind: 'income', icon: '💼', fixed: true },
  { id: 'cat-renda-extra', name: 'Renda extra', kind: 'income', icon: '✨', fixed: false },
  { id: 'cat-vendas', name: 'Vendas', kind: 'income', icon: '🛍️', fixed: false },
  { id: 'cat-alimentacao', name: 'Alimentação', kind: 'expense', icon: '🍓', fixed: false },
  { id: 'cat-transporte', name: 'Transporte', kind: 'expense', icon: '🚗', fixed: false },
  { id: 'cat-moradia', name: 'Moradia', kind: 'expense', icon: '🏠', fixed: true },
  { id: 'cat-saude', name: 'Saúde', kind: 'expense', icon: '🩺', fixed: false },
  { id: 'cat-estudos', name: 'Estudos', kind: 'expense', icon: '📚', fixed: true },
  { id: 'cat-lazer', name: 'Lazer', kind: 'expense', icon: '🎀', fixed: false },
  { id: 'cat-assinaturas', name: 'Assinaturas', kind: 'expense', icon: '💿', fixed: true },
  { id: 'cat-compras', name: 'Compras', kind: 'expense', icon: '👛', fixed: false },
  { id: 'cat-presentes', name: 'Presentes', kind: 'expense', icon: '🎁', fixed: false },
  { id: 'cat-outros', name: 'Outros', kind: 'expense', icon: '🦋', fixed: false },
];

export const DEFAULT_SETTINGS: Settings = {
  displayName: '',
  theme: 'pearl',
  currency: 'BRL',
  dateFormat: 'DD/MM/AAAA',
  monthStartDay: 1,
  notifications: { dueSoon: true, overdue: true, budgetAlerts: true, daysBefore: 3 },
  reduceMotion: false,
};

export function emptyData(): AppData {
  return {
    schemaVersion: 1,
    settings: { ...DEFAULT_SETTINGS, notifications: { ...DEFAULT_SETTINGS.notifications } },
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    accounts: [],
    cards: [],
    transactions: [],
    installments: [],
    invoicePayments: [],
    goals: [],
    budgets: {},
  };
}

export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  checking: 'Conta corrente',
  digital: 'Conta digital',
  cash: 'Dinheiro em espécie',
  savings: 'Poupança',
  other: 'Outra',
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  pix: 'Pix',
  debit: 'Débito',
  credit: 'Crédito',
  cash: 'Dinheiro',
  transfer: 'Transferência/TED',
  boleto: 'Boleto',
  auto_debit: 'Débito automático',
  other: 'Outro',
};

export const TX_TYPE_LABEL: Record<string, string> = {
  income: 'Receita',
  expense: 'Despesa',
  transfer: 'Transferência',
};

export const CARD_THEMES: { id: string; label: string }[] = [
  { id: 'bubblegum', label: 'Bubblegum' },
  { id: 'lilac', label: 'Lilás' },
  { id: 'chrome', label: 'Cromado' },
  { id: 'holo', label: 'Holográfico' },
  { id: 'midnight', label: 'Meia-noite' },
];

export const SWATCHES = ['#DB65AA', '#9676D5', '#F4A6CC', '#7FB7E8', '#6FC3A0', '#E8A55B', '#B07BD9', '#E07A8C'];
export const GOAL_ICONS = ['✈️', '💻', '🏝️', '🛟', '🎓', '💍', '🏠', '🚗', '📷', '🦋', '⭐', '💖'];
