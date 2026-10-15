// Modelo de dados do Glossy Money.
// Todos os valores monetários são inteiros em CENTAVOS para evitar erros de ponto flutuante.
// Datas são strings ISO 'AAAA-MM-DD'; meses são 'AAAA-MM'.

export type ISODate = string;
export type MonthKey = string;
export type Cents = number;

export type TxType = 'income' | 'expense' | 'transfer';
export type TxStatus = 'paid' | 'pending';
export type PaymentMethod =
  | 'pix'
  | 'debit'
  | 'credit'
  | 'cash'
  | 'transfer'
  | 'boleto'
  | 'auto_debit'
  | 'other';

export interface Category {
  id: string;
  name: string;
  kind: 'income' | 'expense';
  icon: string;
  /** Despesa fixa (recorrente) vs variável — usada nos relatórios. */
  fixed: boolean;
}

export type AccountType = 'checking' | 'digital' | 'cash' | 'savings' | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  /** Saldo na data de início do controle. */
  initialBalance: Cents;
  startDate: ISODate;
  color: string;
  archived?: boolean;
}

export interface CreditCard {
  id: string;
  name: string;
  nickname: string;
  limit: Cents;
  /** Dia de fechamento da fatura (1–28). Compras a partir deste dia vão para a fatura seguinte. */
  closingDay: number;
  /** Dia de vencimento (1–28). */
  dueDay: number;
  paymentAccountId: string;
  theme: CardTheme;
  archived?: boolean;
}

export type CardTheme = 'bubblegum' | 'lilac' | 'chrome' | 'holo' | 'midnight';

export interface Transaction {
  id: string;
  description: string;
  /** Sempre positivo. O sinal vem do tipo. */
  amount: Cents;
  type: TxType;
  categoryId: string | null;
  /** Data de competência (quando o fato aconteceu). */
  competenceDate: ISODate;
  dueDate: ISODate | null;
  /** Data de pagamento/recebimento. Obrigatória quando status = paid (fora do cartão). */
  paidDate: ISODate | null;
  /** Conta de origem (despesa/transferência) ou destino (receita). Nulo para compras no cartão. */
  accountId: string | null;
  /** Conta de destino em transferências. */
  toAccountId: string | null;
  /** Cartão de crédito, quando a despesa foi feita no cartão. */
  cardId: string | null;
  /** Fatura ('AAAA-MM' do vencimento) em que a compra no cartão é cobrada. Pode ser corrigida manualmente. */
  invoiceMonth: MonthKey | null;
  paymentMethod: PaymentMethod;
  /** Para compras no cartão o status é derivado da fatura; este campo é ignorado. */
  status: TxStatus;
  notes: string;
  /** Parcelamento ao qual esta parcela pertence. */
  installmentId: string | null;
  installmentNumber: number | null;
  createdAt: string;
}

export interface Installment {
  id: string;
  description: string;
  total: Cents;
  count: number;
  purchaseDate: ISODate;
  /** Fatura da 1ª parcela ('AAAA-MM'); calculada pela regra de fechamento mas pode ser ajustada. */
  firstInvoiceMonth: MonthKey;
  cardId: string;
  categoryId: string | null;
  notes: string;
  createdAt: string;
}

/** Pagamento de fatura: liquida uma obrigação, NÃO é despesa de consumo. */
export interface InvoicePayment {
  id: string;
  cardId: string;
  invoiceMonth: MonthKey;
  amount: Cents;
  date: ISODate;
  accountId: string;
}

export interface GoalContribution {
  id: string;
  date: ISODate;
  /** Positivo = reservar; negativo = resgatar. */
  amount: Cents;
  accountId: string;
  note: string;
}

export interface Goal {
  id: string;
  name: string;
  description: string;
  target: Cents;
  targetDate: ISODate | null;
  priority: 'low' | 'medium' | 'high';
  color: string;
  icon: string;
  contributions: GoalContribution[];
  createdAt: string;
}

export interface MonthBudget {
  /** Limite geral de despesas do mês (opcional). */
  overall: Cents | null;
  /** Limite por categoria. */
  categories: Record<string, Cents>;
  /** Meta mensal de economia (receitas − despesas). */
  savingsGoal: Cents | null;
}

export interface Settings {
  displayName: string;
  theme: 'pearl' | 'lilac' | 'midnight';
  currency: 'BRL';
  dateFormat: 'DD/MM/AAAA';
  /** Primeiro dia do mês financeiro (1–28). */
  monthStartDay: number;
  notifications: {
    dueSoon: boolean;
    overdue: boolean;
    budgetAlerts: boolean;
    daysBefore: number;
  };
  reduceMotion: boolean;
}

export interface AppData {
  schemaVersion: 1;
  settings: Settings;
  categories: Category[];
  accounts: Account[];
  cards: CreditCard[];
  transactions: Transaction[];
  installments: Installment[];
  invoicePayments: InvoicePayment[];
  goals: Goal[];
  budgets: Record<MonthKey, MonthBudget>;
}
