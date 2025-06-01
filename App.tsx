
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Expense, ExpenseCategory, QueryType, MonthlySummaryData, CATEGORY_COLORS, CATEGORY_TEXT_COLORS, CATEGORY_BG_LIGHT_COLORS } from './types';
import { parseExpenseInputWithGemini, categorizeExpenseWithGemini, interpretUserQueryWithGemini } from './services/aiService';

// Helper: Category Icons
const CategoryIcon: React.FC<{ category: ExpenseCategory }> = ({ category }) => {
  const icons: Record<ExpenseCategory, string> = {
    [ExpenseCategory.ALIMENTACAO]: '🍔',
    [ExpenseCategory.TRANSPORTE]: '🚗',
    [ExpenseCategory.LAZER]: '🎉',
    [ExpenseCategory.CONTAS_FIXAS]: '🏠',
    [ExpenseCategory.SAUDE]: '💊',
    [ExpenseCategory.INVESTIMENTOS]: '📈',
    [ExpenseCategory.EDUCACAO]: '📚',
    [ExpenseCategory.COMPRAS]: '🛍️',
    [ExpenseCategory.OUTROS]: '📎',
  };
  return <span className="text-xl mr-2">{icons[category] || '❔'}</span>;
};

// Helper: Format Currency
const formatCurrency = (amount: number) => {
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Helper: Format Date (DD/MM/YY)
const formatDateShort = (dateString: string) => { // YYYY-MM-DD
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year.slice(2)}`;
};

// Helper: Format Month Year (NomeMês/YYYY)
const formatMonthYear = (monthYear: string) => { // YYYY-MM
  const [year, month] = monthYear.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
};

// Get current month in YYYY-MM format, considering GMT-3 (America/Sao_Paulo)
const getCurrentMonthYearGMT3 = (): string => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', { // en-CA results in YYYY-MM-DD format
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  });
  // Extract parts to build YYYY-MM
  const parts = formatter.formatToParts(now).reduce((acc, part) => {
    if (part.type === 'year' || part.type === 'month') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {} as Record<string, string>);
  return `${parts.year}-${parts.month}`;
};


// Bar Chart Component for Monthly Summary
const MonthlyBarChart: React.FC<{ summary: MonthlySummaryData | null }> = ({ summary }) => {
  if (!summary || summary.grandTotal === 0) {
    return null;
  }

  const sortedCategories = Object.entries(summary.categoryTotals)
    .filter(([, amount]) => amount > 0)
    .sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-2 mt-4">
      <h4 className="text-md font-semibold text-slate-600 mb-2">Distribuição de Gastos:</h4>
      {sortedCategories.map(([category, amount]) => {
        const percentage = (amount / summary.grandTotal) * 100;
        const catKey = category as ExpenseCategory;
        return (
          <div key={category} className="mb-1">
            <div className="flex justify-between text-sm text-slate-700 mb-0.5">
              <span><CategoryIcon category={catKey} />{category}</span>
              <span>{formatCurrency(amount)} ({percentage.toFixed(1)}%)</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
              <div
                className={`${CATEGORY_COLORS[catKey]} h-4 rounded-full`}
                style={{ width: `${percentage}%` }}
                role="progressbar"
                aria-valuenow={percentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Gasto em ${category}: ${percentage.toFixed(1)}%`}
              ></div>
            </div>
          </div>
        );
      })}
    </div>
  );
};


const App: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [userInput, setUserInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [apiKeyExists, setApiKeyExists] = useState<boolean>(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthYearGMT3());

  useEffect(() => {
    if (!process.env.API_KEY) {
      setApiKeyExists(false);
      setToast({ message: 'Chave de API do Gemini não configurada. Funcionalidades de IA desabilitadas.', type: 'error' });
    }
    const storedExpenses = localStorage.getItem('expenses');
    if (storedExpenses) {
      // Ensure loaded expenses are also sorted chronologically
      const parsedExpenses = JSON.parse(storedExpenses) as Expense[];
      setExpenses(parsedExpenses.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('expenses', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), toast.type === 'info' ? 7000 : 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    expenses.forEach(exp => months.add(exp.date.slice(0, 7)));
    if (!months.has(getCurrentMonthYearGMT3())) { 
        months.add(getCurrentMonthYearGMT3());
    }
    // Sort ascending (oldest first)
    return Array.from(months).sort((a,b) => a.localeCompare(b)); 
  }, [expenses]);
  
  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
        // If current selectedMonth is no longer valid (e.g. all expenses removed from it),
        // default to the most recent available month, or current month if all are gone.
        setSelectedMonth(availableMonths[availableMonths.length -1] || getCurrentMonthYearGMT3());
    } else if (availableMonths.length === 0 && selectedMonth !== getCurrentMonthYearGMT3()) {
        setSelectedMonth(getCurrentMonthYearGMT3());
    }
  }, [availableMonths, selectedMonth]);


  const monthlySummaryData = useMemo<MonthlySummaryData | null>(() => {
    const summary: Record<ExpenseCategory, number> = Object.values(ExpenseCategory).reduce((acc, cat) => {
      acc[cat] = 0;
      return acc;
    }, {} as Record<ExpenseCategory, number>);

    let grandTotal = 0;
    let highestSpending: { category: ExpenseCategory; amount: number } | null = null;

    expenses
      .filter(exp => exp.date.startsWith(selectedMonth))
      .forEach(exp => {
        summary[exp.category] = (summary[exp.category] || 0) + exp.amount;
        grandTotal += exp.amount;
        if (!highestSpending || summary[exp.category] > highestSpending.amount) {
          highestSpending = { category: exp.category, amount: summary[exp.category] };
        }
      });
    
    if (grandTotal === 0 && Object.values(summary).every(s => s === 0)) return null;

    return {
      categoryTotals: summary,
      grandTotal,
      highestSpending,
      monthLabel: formatMonthYear(selectedMonth),
    };
  }, [expenses, selectedMonth]);


  const handleAddExpense = async (parsedData: { valor: number; descricao: string; data: string }, originalInputText: string) => {
    setIsLoading(true);
    try {
      const categorized = await categorizeExpenseWithGemini(parsedData.descricao);
      const category = categorized?.categoria || ExpenseCategory.OUTROS;

      let finalDate = parsedData.data;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(finalDate) || isNaN(new Date(finalDate).getTime())) {
        setToast({ message: `❌ Data inválida (${parsedData.data}) recebida do processamento. Por favor, tente especificar a data como AAAA-MM-DD.`, type: 'error' });
        setIsLoading(false);
        return;
      }

      const newExpense: Expense = {
        id: new Date().toISOString() + Math.random(),
        amount: parsedData.valor,
        description: parsedData.descricao,
        date: finalDate, // This date is already YYYY-MM-DD from Gemini (representing SP time)
        category,
        originalInput: originalInputText,
      };
      // Add new expense and re-sort all expenses chronologically (oldest first)
      setExpenses(prev => [...prev, newExpense].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      setToast({ message: `✅ Despesa registrada: ${formatCurrency(newExpense.amount)} em ${newExpense.category} (${formatDateShort(newExpense.date)})`, type: 'success' });
      setUserInput('');
      
      const expenseMonth = newExpense.date.slice(0,7);
      // If the expense was added to a month that isn't currently selected,
      // and that month is "newer" or different, consider switching.
      // For now, we'll switch to the expense's month if it's different from the selected one,
      // to make it immediately visible.
      if (selectedMonth !== expenseMonth) {
         setSelectedMonth(expenseMonth);
      }

    } catch (error) {
      console.error("Erro ao adicionar despesa:", error);
      setToast({ message: '❌ Erro ao processar despesa.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessInput = async () => {
    if (!userInput.trim() || !apiKeyExists) {
      if (!apiKeyExists) setToast({ message: 'Chave de API não configurada.', type: 'error'});
      else setToast({ message: 'Por favor, insira uma descrição ou comando.', type: 'error'});
      return;
    }
    setIsLoading(true);

    const queryInterpretation = await interpretUserQueryWithGemini(userInput);

    if (queryInterpretation?.tipoQuery === QueryType.REGISTRO_DESPESA) {
      const parsedExpense = await parseExpenseInputWithGemini(userInput);
      if (parsedExpense && parsedExpense.valor != null && parsedExpense.descricao != null && parsedExpense.data != null) {
        await handleAddExpense({ valor: parsedExpense.valor, descricao: parsedExpense.descricao, data: parsedExpense.data }, userInput);
      } else {
        setToast({ message: '❌ Não foi possível entender os detalhes da despesa. Tente ser mais específico (valor, descrição, data AAAA-MM-DD).', type: 'error' });
        setIsLoading(false);
      }
    } else if (queryInterpretation?.tipoQuery === QueryType.RESUMO_GERAL) {
      setToast({ message: `✅ Resumo de ${formatMonthYear(selectedMonth)} exibido abaixo.`, type: 'info' });
      setUserInput(''); 
      setIsLoading(false);
      document.getElementById('monthly-summary-section')?.scrollIntoView({ behavior: 'smooth' });
    } else if (queryInterpretation?.tipoQuery === QueryType.TOTAL_CATEGORIA && queryInterpretation.categoria) {
      const category = queryInterpretation.categoria;
      const total = monthlySummaryData?.categoryTotals[category] || 0;
      setToast({ message: `Total de ${category} em ${formatMonthYear(selectedMonth)}: ${formatCurrency(total)}`, type: 'info' });
      setUserInput('');
      setIsLoading(false);
    } else { 
      setToast({ message: 'Não entendi o comando. Tente "resumo do mês" ou registrar uma despesa.', type: 'error' });
      setIsLoading(false);
    }
  };
  
  const expensesForSelectedMonth = useMemo(() => {
    // Expenses are already sorted globally by date ascending. Filter will preserve this order.
    return expenses.filter(exp => exp.date.startsWith(selectedMonth));
  }, [expenses, selectedMonth]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col items-center p-4 sm:p-8">
      {toast && (
        <div className={`fixed top-5 right-5 p-4 rounded-lg shadow-lg text-white z-50 ${
            toast.type === 'success' ? 'bg-green-500' : 
            toast.type === 'error' ? 'bg-red-500' : 'bg-sky-500'
          } max-w-md`}>
          <pre className="whitespace-pre-wrap text-sm">{toast.message}</pre>
        </div>
      )}

      <header className="w-full max-w-3xl mb-6 text-center">
        <h1 className="text-4xl font-bold text-sky-700">Gestor Financeiro Pessoal</h1>
      </header>

      <main className="w-full max-w-3xl space-y-8">
        <section className="bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold mb-1 text-slate-700">Adicionar Despesa ou Consultar</h2>
          <p className="text-sm text-slate-500 mb-4">
            Ex: "Lanche R$30 ontem", "Gasolina 120 dia 15/07/2024", "resumo do mês"
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Qual foi sua primeira despesa do mês?"
              className="flex-grow p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-shadow"
              onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleProcessInput()}
              disabled={isLoading || !apiKeyExists}
              aria-label="Entrada de despesa ou comando"
            />
            <button
              onClick={handleProcessInput}
              disabled={isLoading || !userInput.trim() || !apiKeyExists}
              className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              aria-busy={isLoading}
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : "Processar"}
            </button>
          </div>
          {!apiKeyExists && <p className="text-red-500 text-sm mt-2">A chave da API do Gemini não está configurada. O processamento de IA está desabilitado.</p>}
        </section>

        <section className="bg-white p-6 rounded-xl shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-slate-700">Navegação Mensal</h2>
            <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-4">
                {availableMonths.length > 0 ? availableMonths.map(monthStr => (
                    <button
                        key={monthStr}
                        onClick={() => setSelectedMonth(monthStr)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors
                            ${selectedMonth === monthStr 
                                ? 'bg-sky-600 text-white shadow-md' 
                                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
                    >
                        {formatMonthYear(monthStr)}
                    </button>
                )) : (
                    <p className="text-slate-500">Nenhum mês com despesas ainda. Registre sua primeira despesa!</p>
                )}
            </div>
        
            <div id="monthly-summary-section">
                <h3 className="text-xl font-semibold text-sky-700 mb-1">Resumo de {monthlySummaryData?.monthLabel || formatMonthYear(selectedMonth)}</h3>
                {monthlySummaryData ? (
                <>
                    <p className="text-slate-600">Total Gasto no Mês: <span className="font-bold text-lg">{formatCurrency(monthlySummaryData.grandTotal)}</span></p>
                    {monthlySummaryData.highestSpending && (
                    <p className="text-slate-600">
                        Categoria Destaque: 
                        <span className={`font-semibold ${CATEGORY_TEXT_COLORS[monthlySummaryData.highestSpending.category]}`}>
                         {' '}{monthlySummaryData.highestSpending.category}
                        </span> ({formatCurrency(monthlySummaryData.highestSpending.amount)})
                    </p>
                    )}
                    <MonthlyBarChart summary={monthlySummaryData} />
                </>
                ) : (
                <p className="text-slate-500 mt-4">Nenhuma despesa registrada para {formatMonthYear(selectedMonth)}.</p>
                )}
            </div>
        </section>
        
        <section className="bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-slate-700">Despesas de {formatMonthYear(selectedMonth)}</h2>
          {expensesForSelectedMonth.length > 0 ? (
            <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {expensesForSelectedMonth.map((exp) => (
                <li key={exp.id} className={`p-3 ${CATEGORY_BG_LIGHT_COLORS[exp.category]} rounded-lg shadow-sm border-l-4 ${CATEGORY_COLORS[exp.category].replace('bg-','border-')}`}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center">
                      <CategoryIcon category={exp.category} />
                      <span className="font-medium text-slate-800">{exp.description}</span>
                    </div>
                    <span className={`font-bold ${CATEGORY_TEXT_COLORS[exp.category]}`}>{formatCurrency(exp.amount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span>{formatDateShort(exp.date)} - <em className="italic">"{exp.originalInput.length > 30 ? exp.originalInput.substring(0,27) + '...' : exp.originalInput }"</em></span>
                    <span className={`px-2 py-0.5 ${CATEGORY_BG_LIGHT_COLORS[exp.category]} ${CATEGORY_TEXT_COLORS[exp.category]} rounded-full text-xs font-semibold`}>{exp.category}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
             <p className="text-slate-500">Nenhuma despesa registrada para {formatMonthYear(selectedMonth)}.</p>
          )}
        </section>
      </main>
      <footer className="w-full max-w-3xl mt-12 text-center text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} Gestor Financeiro Pessoal. Simplificando suas finanças.</p>
      </footer>
    </div>
  );
};

export default App;
