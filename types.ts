export enum ExpenseCategory {
  ALIMENTACAO = "Alimentação",
  TRANSPORTE = "Transporte",
  LAZER = "Lazer",
  CONTAS_FIXAS = "Contas Fixas",
  SAUDE = "Saúde",
  INVESTIMENTOS = "Investimentos",
  EDUCACAO = "Educação",
  COMPRAS = "Compras",
  OUTROS = "Outros",
}

export interface Expense {
  id: string;
  amount: number;
  description: string;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  originalInput: string;
}

export interface ParsedExpenseData {
  valor: number | null;
  descricao: string | null;
  data: string | null; // YYYY-MM-DD
}

export interface CategorizedData {
  categoria: ExpenseCategory | null;
}

export enum QueryType {
  RESUMO_GERAL = "RESUMO_GERAL",
  TOTAL_CATEGORIA = "TOTAL_CATEGORIA",
  DESCONHECIDO = "DESCONHECIDO",
  REGISTRO_DESPESA = "REGISTRO_DESPESA" // Internal type to signal expense processing
}

export interface ParsedQuery {
  tipoQuery: QueryType;
  categoria?: ExpenseCategory;
}

// Helper array for Gemini prompts
export const CATEGORY_NAMES_ARRAY = Object.values(ExpenseCategory);

export interface MonthlySummaryData {
  categoryTotals: Record<ExpenseCategory, number>;
  grandTotal: number;
  highestSpending: { category: ExpenseCategory; amount: number } | null;
  monthLabel: string; // e.g., "Maio/2024"
}

export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.ALIMENTACAO]: 'bg-red-500',
  [ExpenseCategory.TRANSPORTE]: 'bg-blue-500',
  [ExpenseCategory.LAZER]: 'bg-green-500',
  [ExpenseCategory.CONTAS_FIXAS]: 'bg-yellow-500', // Note: Tailwind yellow-500 can be light, consider -600 or -700 for text contrast if needed.
  [ExpenseCategory.SAUDE]: 'bg-purple-500',
  [ExpenseCategory.INVESTIMENTOS]: 'bg-indigo-500',
  [ExpenseCategory.EDUCACAO]: 'bg-pink-500',
  [ExpenseCategory.COMPRAS]: 'bg-teal-500',
  [ExpenseCategory.OUTROS]: 'bg-gray-500',
};

export const CATEGORY_TEXT_COLORS: Record<ExpenseCategory, string> = {
    [ExpenseCategory.ALIMENTACAO]: 'text-red-700',
    [ExpenseCategory.TRANSPORTE]: 'text-blue-700',
    [ExpenseCategory.LAZER]: 'text-green-700',
    [ExpenseCategory.CONTAS_FIXAS]: 'text-yellow-700',
    [ExpenseCategory.SAUDE]: 'text-purple-700',
    [ExpenseCategory.INVESTIMENTOS]: 'text-indigo-700',
    [ExpenseCategory.EDUCACAO]: 'text-pink-700',
    [ExpenseCategory.COMPRAS]: 'text-teal-700',
    [ExpenseCategory.OUTROS]: 'text-gray-700',
  };

  export const CATEGORY_BG_LIGHT_COLORS: Record<ExpenseCategory, string> = {
    [ExpenseCategory.ALIMENTACAO]: 'bg-red-100',
    [ExpenseCategory.TRANSPORTE]: 'bg-blue-100',
    [ExpenseCategory.LAZER]: 'bg-green-100',
    [ExpenseCategory.CONTAS_FIXAS]: 'bg-yellow-100',
    [ExpenseCategory.SAUDE]: 'bg-purple-100',
    [ExpenseCategory.INVESTIMENTOS]: 'bg-indigo-100',
    [ExpenseCategory.EDUCACAO]: 'bg-pink-100',
    [ExpenseCategory.COMPRAS]: 'bg-teal-100',
    [ExpenseCategory.OUTROS]: 'bg-gray-100',
  };