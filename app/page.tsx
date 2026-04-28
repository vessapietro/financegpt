"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type TransactionType = "expense" | "income" | "investment";

type Transaction = {
  id: string;
  date: string;
  monthKey: string;
  local: string;
  value: number;
  category: string;
  type: TransactionType;
  source: string;
};

type ChatMessage = {
  role: "user" | "app";
  text: string;
};

type SpeechRecognitionConstructor = new () => SpeechRecognition;
type SpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const categoryTargets = [
  { name: "🍔 Alimentação", meta: 500, keywords: ["pizza", "restaurante", "lanche", "ifood", "comida", "café", "cafe", "nils", "padaria"] },
  { name: "🛒 Mercado", meta: 700, keywords: ["mercado", "supermercado", "angeloni", "super festival", "festival", "festval", "condor"] },
  { name: "🎉 Lazer", meta: 400, keywords: ["balada", "cinema", "bar", "show", "festa", "lazer"] },
  { name: "🚗 Transporte", meta: 300, keywords: ["99", "99ride", "uber", "corrida", "transporte", "estacionamento", "posto", "gasolina"] },
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

const defaultChat: ChatMessage[] = [
  { role: "app", text: "Dashboard financeiro ativo. Envie um gasto por texto ou áudio. Ex: gastei 54,60 no Nils Pizza." },
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

function normalizeSpeechNumbers(text: string) {
  return String(text)
    .replace(/\bzero\b/gi, "0")
    .replace(/\bum\b/gi, "1")
    .replace(/\buma\b/gi, "1")
    .replace(/\bdois\b/gi, "2")
    .replace(/\bduas\b/gi, "2")
    .replace(/\btrês\b/gi, "3")
    .replace(/\btres\b/gi, "3")
    .replace(/\bquatro\b/gi, "4")
    .replace(/\bcinco\b/gi, "5")
    .replace(/\bseis\b/gi, "6")
    .replace(/\bsete\b/gi, "7")
    .replace(/\boito\b/gi, "8")
    .replace(/\bnove\b/gi, "9")
    .replace(/\bdez\b/gi, "10")
    .replace(/\bonze\b/gi, "11")
    .replace(/\bdoze\b/gi, "12")
    .replace(/\btreze\b/gi, "13")
    .replace(/\bcatorze\b/gi, "14")
    .replace(/\bquatorze\b/gi, "14")
    .replace(/\bquinze\b/gi, "15")
    .replace(/\bdezesseis\b/gi, "16")
    .replace(/\bdezessete\b/gi, "17")
    .replace(/\bdezoito\b/gi, "18")
    .replace(/\bdezenove\b/gi, "19")
    .replace(/\bvinte e quatro\b/gi, "24")
    .replace(/\btrinta e seis\b/gi, "36")
    .replace(/\bcinquenta e quatro\b/gi, "54")
    .replace(/\bsetenta e quatro\b/gi, "74")
    .replace(/\bduzentos e vinte e quatro\b/gi, "224")
    .replace(/\bonze e setenta e um\b/gi, "11,71")
    .replace(/\bdoze e seis\b/gi, "12,06")
    .replace(/\bdoze e zero seis\b/gi, "12,06")
    .replace(/\bcinquenta e quatro e sessenta\b/gi, "54,60")
    .replace(/\bsetenta e quatro e sessenta e oito\b/gi, "74,68")
    .replace(/\bsete e noventa e nove\b/gi, "7,99");
}

function parseMoney(raw: string) {
  const cleaned = String(raw)
    .replace(/r\$\s*/i, "")
    .replace(/\s/g, "")
    .trim();

  if (!cleaned) return 0;

  if (cleaned.includes(",")) {
    return Number(cleaned.replace(/\./g, "").replace(",", "."));
  }

  return Number(cleaned);
}

function extractValue(text: string) {
  const normalized = normalizeSpeechNumbers(text);
  const currencyOrDecimal = normalized.match(/r\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?|r\$\s*\d+(?:[.,]\d{1,2})?|\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{1,2}/gi);

  if (currencyOrDecimal?.length) {
    const values = currencyOrDecimal
      .map(parseMoney)
      .filter((value) => Number.isFinite(value) && value > 0);
    if (values.length) return values[0];
  }

  const integerAfterVerb = normalized.match(/(?:gastei|gasto|paguei|recebi|recebido|custou|valor foi|foi|deu)\s+(?:r\$\s*)?(\d+)/i);
  if (integerAfterVerb?.[1]) {
    const value = Number(integerAfterVerb[1]);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  const currencyInteger = normalized.match(/r\$\s*(\d+)/i);
  if (currencyInteger?.[1]) {
    const value = Number(currencyInteger[1]);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  return 0;
}

function detectCategory(text: string) {
  const normalized = String(text).toLowerCase();
  const found = categoryTargets.find((category) => category.keywords.some((keyword) => normalized.includes(keyword)));
  return found ? found.name : "📦 Não identificado";
}

function detectLocal(text: string, value: number) {
  const normalized = normalizeSpeechNumbers(text);
  const valueBR = String(value).replace(".", ",");
  const valueUS = String(value);
  const cleaned = normalized
    .replace(new RegExp(`r\\$\\s*${valueBR.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi"), " ")
    .replace(new RegExp(`r\\$\\s*${valueUS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi"), " ")
    .replace(valueBR, " ")
    .replace(valueUS, " ")
    .replace(/\b(gastei|gasto|paguei|recebi|recebido|custou|valor|foi|deu|no|na|em|de|do|da|num|numa|com|cartão|cartao|pix|reais|real)\b/gi, " ")
    .replace(/[.,;:!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "não identificado no arquivo";
}

function isCancelCommand(text: string) {
  return /\b(cancelar|cancela|desfazer|apagar|remover|excluir)\b.*\b(último|ultimo|gasto|lançamento|lancamento|compra)\b/i.test(String(text));
}

function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
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
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export default function Page() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "historico">("dashboard");
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [expandedMonth, setExpandedMonth] = useState("Abr/2026");
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>(defaultChat);
  const [loaded, setLoaded] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setTransactions(loadStored("financegpt.transactions", initialTransactions));
    setChat(loadStored("financegpt.chat", defaultChat));
    setExpandedMonth(loadStored("financegpt.expandedMonth", "Abr/2026"));
    setActiveTab(loadStored("financegpt.activeTab", "dashboard"));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveStored("financegpt.transactions", transactions);
  }, [transactions, loaded]);

  useEffect(() => {
    if (loaded) saveStored("financegpt.chat", chat);
  }, [chat, loaded]);

  useEffect(() => {
    if (loaded) saveStored("financegpt.expandedMonth", expandedMonth);
  }, [expandedMonth, loaded]);

  useEffect(() => {
    if (loaded) saveStored("financegpt.activeTab", activeTab);
  }, [activeTab, loaded]);

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

    return Object.entries(grouped)
      .map(([month, items]) => ({
        month,
        receita: month === currentMonthKey ? 6000 : 0,
        gastos: items.filter((i) => i.type === "expense").reduce((acc, i) => acc + i.value, 0),
        receitasExtras: items.filter((i) => i.type === "income").reduce((acc, i) => acc + i.value, 0),
        transactions: items,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [transactions, currentMonthKey]);

  const alert = categories.find((item) => item.gasto / item.meta >= 0.75);

  function cancelTransaction(id: string) {
    const transaction = transactions.find((item) => item.id === id);
    setTransactions((current) => current.filter((item) => item.id !== id));
    if (transaction) {
      setChat((current) => [...current, { role: "app", text: `Lançamento cancelado: ${transaction.local} • ${formatBRL(transaction.value)}.` }]);
    }
  }

  function processMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    setChat((current) => [...current, { role: "user", text: trimmed }]);

    if (isCancelCommand(trimmed)) {
      const last = transactions[0];
      if (last) {
        cancelTransaction(last.id);
      } else {
        setChat((current) => [...current, { role: "app", text: "Não existe lançamento para cancelar." }]);
      }
      setMessage("");
      return;
    }

    const value = extractValue(trimmed);
    const isIncome = /\b(recebi|recebido|entrada|pix recebido|transferência recebida|transferencia recebida)\b/i.test(trimmed);

    if (!value) {
      setChat((current) => [...current, { role: "app", text: "Não identifiquei um valor nessa mensagem. Tente: gastei 54,60 no mercado." }]);
      setMessage("");
      return;
    }

    const transaction: Transaction = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
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
      {
        role: "app",
        text: isIncome
          ? `Receita registrada: ${formatBRL(value)}.`
          : `Gasto registrado em ${transaction.category}: ${formatBRL(value)}.`,
      },
    ]);
    setMessage("");
  }

  function handleVoiceInput() {
    const SpeechRecognition = getSpeechRecognition();

    if (!SpeechRecognition) {
      setVoiceStatus("Seu navegador não suporta áudio aqui. Use Chrome ou Edge e permita o microfone.");
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      setVoiceStatus("Áudio parado.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceStatus("Ouvindo... fale o gasto agora.");
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();

      setMessage(transcript);
      processMessage(transcript);
      setVoiceStatus(transcript ? `Áudio identificado: “${transcript}”` : "Não consegui entender o áudio.");
    };

    recognition.onerror = () => {
      setIsListening(false);
      setVoiceStatus("Não consegui acessar o microfone ou entender o áudio.");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function clearData() {
    const confirmed = window.confirm("Tem certeza que deseja apagar os dados salvos?");
    if (!confirmed) return;
    setTransactions(initialTransactions);
    setChat(defaultChat);
    window.localStorage.removeItem("financegpt.transactions");
    window.localStorage.removeItem("financegpt.chat");
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white md:p-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <div className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-white">
          ✅ FinanceGPT atualizado: valores corrigidos + áudio ativado.
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setActiveTab("dashboard")} className={activeTab === "dashboard" ? "rounded-2xl bg-white px-4 py-2 font-medium text-slate-950" : "rounded-2xl bg-slate-800 px-4 py-2 font-medium text-white"}>
            Dashboard
          </button>
          <button onClick={() => setActiveTab("historico")} className={activeTab === "historico" ? "rounded-2xl bg-white px-4 py-2 font-medium text-slate-950" : "rounded-2xl bg-slate-800 px-4 py-2 font-medium text-white"}>
            Histórico
          </button>
          <button onClick={clearData} className="rounded-2xl bg-red-500/20 px-4 py-2 font-medium text-red-100">
            Apagar dados
          </button>
        </div>

        <header>
          <p className="mb-3 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-200">
            Ciclo financeiro: dia 10 ao dia 09
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">FinanceGPT</h1>
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
                <h2 className="text-xl font-semibold text-white">Gastos por categoria</h2>
                <p className="mt-1 text-sm text-slate-200">Meta mensal, gasto atual e saldo disponível.</p>

                <div className="mt-5 grid gap-4">
                  {categories.map((item) => {
                    const percent = item.meta ? (item.gasto / item.meta) * 100 : 0;
                    const remaining = item.meta - item.gasto;
                    return (
                      <div key={item.name} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                        <div className="mb-3 flex justify-between gap-4">
                          <div>
                            <p className="font-medium text-white">{item.name}</p>
                            <p className="text-sm text-slate-200">Meta: {formatBRL(item.meta)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-white">{formatBRL(item.gasto)}</p>
                            <p className={remaining >= 0 ? "text-sm text-emerald-300" : "text-sm text-red-300"}>
                              {remaining >= 0 ? `${formatBRL(remaining)} livre` : `${formatBRL(Math.abs(remaining))} acima`}
                            </p>
                          </div>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(percent, 100)}%` }} />
                        </div>
                        <p className="mt-2 text-xs text-slate-200">{percent.toFixed(0)}% consumido</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-6">
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                  <h2 className="text-xl font-semibold text-white">Alertas CFO</h2>
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
                  <h2 className="text-xl font-semibold text-white">Chat financeiro</h2>
                  <p className="mb-2 mt-1 text-sm text-slate-200">Texto ou áudio. Ex: gastei 54,60 no Nils Pizza</p>
                  {voiceStatus && <p className={isListening ? "mb-3 text-sm text-emerald-300" : "mb-3 text-sm text-slate-200"}>{voiceStatus}</p>}

                  <div className="mb-4 flex-1 space-y-3 overflow-auto">
                    {chat.map((item, index) => (
                      <div key={`${item.role}-${index}`} className={item.role === "user" ? "ml-8 rounded-2xl bg-slate-700 p-3 text-white" : "mr-8 rounded-2xl bg-slate-800 p-3 text-white"}>
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
                    <button
                      onClick={handleVoiceInput}
                      className={isListening ? "rounded-2xl bg-red-500 px-4 py-3 font-semibold text-white" : "rounded-2xl bg-slate-800 px-4 py-3 font-semibold text-white"}
                    >
                      {isListening ? "■" : "🎙️"}
                    </button>
                    <button onClick={() => processMessage(message)} className="rounded-2xl bg-white px-4 py-3 font-semibold text-slate-950">
                      ➤
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <TransactionsTable transactions={currentTransactions} onCancel={cancelTransaction} />
          </>
        )}

        {activeTab === "historico" && (
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-2xl font-semibold text-white">Histórico mensal</h2>
            <div className="mt-5 grid gap-4">
              {history.map((month) => {
                const open = expandedMonth === month.month;
                const receitaTotal = month.receita + month.receitasExtras;
                return (
                  <div key={month.month} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="grid gap-3 md:grid-cols-5 md:items-center">
                      <p className="font-semibold text-white">{month.month}</p>
                      <p className="text-white">💰 {formatBRL(receitaTotal)}</p>
                      <p className="text-white">💳 {formatBRL(month.gastos)}</p>
                      <p className="text-emerald-300">🟢 {formatBRL(receitaTotal - month.gastos)}</p>
                      <button onClick={() => setExpandedMonth(open ? "" : month.month)} className="rounded-xl bg-slate-800 px-3 py-2 text-sm text-white">
                        {open ? "Ocultar gastos" : "Ver gastos"}
                      </button>
                    </div>

                    {open && (
                      <div className="mt-4">
                        <TransactionsTable transactions={month.transactions} onCancel={cancelTransaction} />
                      </div>
                    )}
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
      <p className="mt-1 text-2xl font-semibold text-white">{formatBRL(value)}</p>
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
          {transactions.length === 0 && (
            <tr>
              <td className="p-4 text-center text-slate-200" colSpan={6}>
                Nenhum lançamento registrado.
              </td>
            </tr>
          )}
          {transactions.map((item) => (
            <tr key={item.id} className="border-t border-slate-800">
              <td className="p-3 text-white">{item.date}</td>
              <td className="p-3 text-white">{item.local}</td>
              <td className="p-3 text-white">{item.category}</td>
              <td className="p-3 text-white">{item.source}</td>
              <td className={item.type === "income" ? "p-3 text-right text-emerald-300" : "p-3 text-right text-white"}>
                {item.type === "income" ? "+" : ""}
                {formatBRL(item.value)}
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
