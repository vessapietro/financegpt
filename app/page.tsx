"use client";

import { useEffect, useMemo, useState } from "react";

type Transaction = {
  id: string;
  date: string;
  monthKey: string;
  local: string;
  value: number;
  category: string;
  type: "expense" | "income" | "investment";
  source: string;
};

type ChatMessage = {
  role: "user" | "app";
  text: string;
};

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const categoryTargets = [
  { name: "🍔 Alimentação", meta: 500, keywords: ["pizza", "restaurante", "lanche", "ifood", "comida", "café", "cafe", "nils"] },
  { name: "🛒 Mercado", meta: 700, keywords: ["mercado", "supermercado", "angeloni", "super festival", "festival", "festval"] },
  { name: "🎉 Lazer", meta: 400, keywords: ["balada", "cinema", "bar", "show", "festa", "lazer"] },
  { name: "🚗 Transporte", meta: 300, keywords: ["99", "99ride", "uber", "corrida", "transporte", "estacionamento"] },
  { name: "🤖 Assinaturas", meta: 180, keywords: ["assinatura", "netflix", "spotify", "icloud", "chatgpt"] },
  { name: "🏛️ Impostos", meta: 650, keywords: ["das", "darf", "imposto"] },
  { name: "💼 Contador", meta: 250, keywords: ["contador", "contabilidade"] },
  { name: "🌐 Internet", meta: 160, keywords: ["internet", "wifi", "wi-fi"] },
  { name: "💪 Fitness", meta: 250, keywords: ["academia", "eiger", "fitness", "treino"] },
  { name: "🛍️ Compras gerais", meta: 450, keywords: ["presente", "compra", "roupa", "shopping"] },
  { name: "📦 Não identificado", meta: 150, keywords: [] },
];

const initialTransactions: Transaction[] = [
  { id: "1", date: "28/04", monthKey: "Abr/2026", local: "Supermercado Angeloni", value: 7.99, category: "🛒 Mercado", type: "expense", source: "manual" },
  { id: "2", date: "28/04", monthKey: "Abr/2026", local: "Nils Pizza", value: 54.6, category: "🍔 Alimentação", type: "expense", source: "manual" },
  { id: "3", date: "27/04", monthKey: "Abr/2026", local: "99", value: 12.06, category: "🚗 Transporte", type: "expense", source: "manual" },
];

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
}

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
}

function getMonthKeyFromDate(date: Date) {
  return `${monthNames[date.getMonth()]}/${date.getFullYear()}`;
}

function getCurrentMonthKey() {
  return getMonthKeyFromDate(new Date());
}

function parseMoney(text: string) {
  const cleaned = String(text).replace(/r\$\s*/i, "").trim();
  if (cleaned.includes(",")) return Number(cleaned.replace(/\./g, "").replace(",", "."));
  return Number(cleaned);
}

function extractValue(text: string) {
  const matches = String(text).match(/r\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?|r\$\s*\d+(?:[.,]\d{1,2})?|\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{1,2}/gi);
  if (matches?.length) {
    const values = matches.map(parseMoney).filter((value) => Number.isFinite(value) && value > 0);
    return values[0] || 0;
  }

  const integer = String(text).match(/(?:gastei|gasto|paguei|recebi|recebido|custou|valor foi)\s+(?:r\$\s*)?(\d+)/i);
  if (integer?.[1]) return Number(integer[1]);

  return 0;
}

function detectCategory(text: string) {
  const normalized = String(text).toLowerCase();
  const found = categoryTargets.find((category) => category.keywords.some((keyword) => normalized.includes(keyword)));
  return found ? found.name : "📦 Não identificado";
}

function detectLocal(text: string, value: number) {
  const valueBR = String(value).replace(".", ",");
  const cleaned = String(text)
    .replace(valueBR, " ")
    .replace(String(value), " ")
    .replace(/\b(gastei|gasto|paguei|recebi|recebido|custou|valor|foi|no|na|em|de|do|da|num|numa|com|cartão|cartao|pix|reais|real)\b/gi, " ")
    .replace(/[.,;:!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "não identificado no arquivo";
}

function isCancelCommand(text: string) {
  return /\b(cancelar|cancela|desfazer|apagar|remover|excluir)\b.*\b(último|ultimo|gasto|lançamento|lancamento|compra)\b/i.test(String(text));
}

function loadStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function saveStored(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export default function Page() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "historico">("dashboard");
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadStored("financegpt.transactions", initialTransactions));
  const [expandedMonth, setExpandedMonth] = useState("Abr/2026");
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>(() =>
    loadStored("financegpt.chat", [{ role: "app", text: "Dashboard financeiro ativo. Envie um gasto por texto." }])
  );

  useEffect(() => saveStored("financegpt.transactions", transactions), [transactions]);
  useEffect(() => saveStored("financegpt.chat", chat), [chat]);

  const currentMonthKey = getCurrentMonthKey();
  const currentTransactions = transactions.filter((item) => item.monthKey === currentMonthKey || item.monthKey === "Abr/2026");

  const totals = useMemo(() => {
    const receita = 6000 + currentTransactions.filter((t) => t.type === "income").reduce((acc, t) => acc + t.value, 0);
    const gastos = currentTransactions.filter((t) => t.type === "expense").reduce((acc, t) => acc + t.value, 0);
    const investimentos = Math.max((receita - 900) * 0.3, 0);
    const saldo = receita - gastos - investimentos;
    return { receita, gastos, investimentos, saldo };
  }, [currentTransactions]);

  const categories = useMemo(() => {
    return categoryTargets.map((target) => ({
      ...target,
      gasto: currentTransactions
        .filter((transaction) => transaction.type === "expense" && transaction.category === target.name)
        .reduce((acc, transaction) => acc + transaction.value, 0),
    }));
  }, [currentTransactions]);

  const history = useMemo(() => {
    const grouped = transactions.reduce<Record<string, Transaction[]>>((acc, item) => {
      acc[item.monthKey] = acc[item.monthKey] || [];
      acc[item.monthKey].push(item);
      return acc;
    }, {});

    return Object.entries(grouped).map(([month, items]) => ({
      month,
      receita: month === currentMonthKey ? 6000 : 0,
      gastos: items.filter((i) => i.type === "expense").reduce((acc, i) => acc + i.value, 0),
      transactions: items,
    }));
  }, [transactions, currentMonthKey]);

  function processMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (isCancelCommand(trimmed)) {
      const last = transactions[0];
      setChat((current) => [...current, { role: "user", text: trimmed }]);
      if (last) {
        setTransactions((current) => current.filter((item) => item.id !== last.id));
        setChat((current) => [...current, { role: "app", text: `Lançamento cancelado: ${last.local} • ${formatBRL(last.value)}.` }]);
      }
      setMessage("");
      return;
    }

    const value = extractValue(trimmed);
    const isIncome = /\b(recebi|recebido|entrada)\b/i.test(trimmed);

    setChat((current) => [...current, { role: "user", text: trimmed }]);

    if (!value) {
      setChat((current) => [...current, { role: "app", text: "Não identifiquei um valor nessa mensagem." }]);
      return;
    }

    const transaction: Transaction = {
      id: `${Date.now()}`,
      date: formatDateLabel(new Date()),
      monthKey: getCurrentMonthKey(),
      local: detectLocal(trimmed, value),
      value,
      category: isIncome ? "💰 Receita" : detectCategory(trimmed),
      type: isIncome ? "income" : "expense",
      source: "chat",
    };

    setTransactions((current) => [transaction, ...current]);
    setChat((current) => [
      ...current,
      { role: "app", text: isIncome ? `Receita registrada: ${formatBRL(value)}.` : `Gasto registrado: ${formatBRL(value)}.` },
    ]);
    setMessage("");
  }

  const alert = categories.find((item) => item.gasto / item.meta >= 0.75);

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <div className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm">
          FinanceGPT conectado. Dados salvos no navegador.
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setActiveTab("dashboard")} className="rounded-2xl bg-slate-800 px-4 py-2 text-white">Dashboard</button>
          <button onClick={() => setActiveTab("historico")} className="rounded-2xl bg-slate-800 px-4 py-2 text-white">Histórico</button>
        </div>

        <header>
          <p className="mb-3 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-200">
            Ciclo financeiro: dia 10 ao dia 09
          </p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">FinanceGPT</h1>
          <p className="mt-2 text-slate-200">Dashboard financeiro pessoal + chat de lançamentos.</p>
        </header>

        {activeTab === "dashboard" && (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <SummaryCard label="Receita" value={totals.receita} icon="💰" />
              <SummaryCard label="Gastos" value={totals.gastos} icon="💳" />
              <SummaryCard label="Investimentos" value={totals.investimentos} icon="📈" />
              <SummaryCard label="Saldo restante" value={totals.saldo} icon="🐷" highlight />
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 lg:col-span-2">
                <h2 className="text-xl font-semibold">Gastos por categoria</h2>
                <div className="mt-5 grid gap-4">
                  {categories.map((item) => {
                    const percent = item.meta ? (item.gasto / item.meta) * 100 : 0;
                    const remaining = item.meta - item.gasto;
                    return (
                      <div key={item.name} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                        <div className="mb-3 flex justify-between gap-4">
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-slate-200">Meta: {formatBRL(item.meta)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatBRL(item.gasto)}</p>
                            <p className={remaining >= 0 ? "text-sm text-emerald-300" : "text-sm text-red-300"}>
                              {remaining >= 0 ? `${formatBRL(remaining)} livre` : `${formatBRL(Math.abs(remaining))} acima`}
                            </p>
                          </div>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(percent, 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-6">
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                  <h2 className="text-xl font-semibold">Alertas CFO</h2>
                  <div className="mt-4 space-y-3 text-sm text-slate-100">
                    <p>🎯 Meta de sobra final: <strong>{formatBRL(1000)}</strong></p>
                    <p>💸 Limite semanal: <strong>{formatBRL(Math.max((totals.saldo - 1000) / 4, 0))}</strong></p>
                    <p>📆 Limite diário: <strong>{formatBRL(Math.max((totals.saldo - 1000) / 30, 0))}</strong></p>
                    <p className="text-amber-200">
                      {alert ? `${alert.name} está acima de 75% da meta.` : "Nenhuma categoria em ritmo perigoso."}
                    </p>
                  </div>
                </div>

                <div className="flex min-h-[460px] flex-col rounded-3xl border border-slate-800 bg-slate-900 p-5">
                  <h2 className="text-xl font-semibold">Chat financeiro</h2>
                  <p className="mb-4 mt-1 text-sm text-slate-200">Ex: gastei 54,60 no Nils Pizza</p>

                  <div className="mb-4 flex-1 space-y-3 overflow-auto">
                    {chat.map((item, index) => (
                      <div key={index} className={item.role === "user" ? "ml-8 rounded-2xl bg-slate-700 p-3" : "mr-8 rounded-2xl bg-slate-800 p-3"}>
                        <p className="text-sm">{item.text}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && processMessage(message)}
                      placeholder="Digite seu gasto..."
                      className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-400"
                    />
                    <button onClick={() => processMessage(message)} className="rounded-2xl bg-white px-4 py-3 font-semibold text-slate-950">➤</button>
                  </div>
                </div>
              </div>
            </section>

            <TransactionsTable transactions={currentTransactions} onCancel={(id) => setTransactions((current) => current.filter((item) => item.id !== id))} />
          </>
        )}

        {activeTab === "historico" && (
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-2xl font-semibold">Histórico mensal</h2>
            <div className="mt-5 grid gap-4">
              {history.map((month) => {
                const open = expandedMonth === month.month;
                return (
                  <div key={month.month} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="grid gap-3 md:grid-cols-5 md:items-center">
                      <p className="font-semibold">{month.month}</p>
                      <p>💰 {formatBRL(month.receita)}</p>
                      <p>💳 {formatBRL(month.gastos)}</p>
                      <p>🟢 {formatBRL(month.receita - month.gastos)}</p>
                      <button onClick={() => setExpandedMonth(open ? "" : month.month)} className="rounded-xl bg-slate-800 px-3 py-2 text-sm">
                        {open ? "Ocultar gastos" : "Ver gastos"}
                      </button>
                    </div>

                    {open && <TransactionsTable transactions={month.transactions} onCancel={(id) => setTransactions((current) => current.filter((item) => item.id !== id))} />}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function SummaryCard({ label, value, icon, highlight = false }: { label: string; value: number; icon: string; highlight?: boolean }) {
  return (
    <div className={highlight ? "rounded-3xl border border-slate-700 bg-slate-800 p-5 shadow-xl" : "rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl"}>
      <p className="text-2xl">{icon}</p>
      <p className="mt-5 text-sm text-slate-200">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{formatBRL(value)}</p>
    </div>
  );
}

function TransactionsTable({ transactions, onCancel }: { transactions: Transaction[]; onCancel: (id: string) => void }) {
  return (
    <div className="overflow-auto rounded-3xl border border-slate-800 bg-slate-900">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-slate-950 text-slate-200">
          <tr>
            <th className="p-3 text-left">Data</th>
            <th className="p-3 text-left">Local</th>
            <th className="p-3 text-left">Categoria</th>
            <th className="p-3 text-left">Origem</th>
            <th className="p-3 text-right">Valor</th>
            <th className="p-3 text-right">Ação</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((item) => (
            <tr key={item.id} className="border-t border-slate-800">
              <td className="p-3">{item.date}</td>
              <td className="p-3">{item.local}</td>
              <td className="p-3">{item.category}</td>
              <td className="p-3">{item.source}</td>
              <td className={item.type === "income" ? "p-3 text-right text-emerald-300" : "p-3 text-right"}>
                {item.type === "income" ? "+" : ""}{formatBRL(item.value)}
              </td>
              <td className="p-3 text-right">
                <button onClick={() => onCancel(item.id)} className="rounded-xl bg-red-500/20 px-3 py-1 text-xs text-red-100">
                  Cancelar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
