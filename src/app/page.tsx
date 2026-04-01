"use client";

import { useState, useEffect, useRef, useCallback, KeyboardEvent } from "react";
import Link from "next/link";

// ─── Tipos ─────────────────────────────────────────────────────────────────────
type ConversationStatus =
  | "collecting"
  | "awaiting_confirmation"
  | "confirmed"
  | "cancelled";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  customer: string;
  status: ConversationStatus;
  currentOrder: unknown;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// ─── StatusBadge ───────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  ConversationStatus,
  { label: string; classes: string; dot: string }
> = {
  collecting: {
    label: "Em andamento",
    classes: "bg-amber-100 text-amber-700",
    dot: "bg-amber-400",
  },
  awaiting_confirmation: {
    label: "Aguardando confirmação",
    classes: "bg-blue-100 text-blue-700",
    dot: "bg-blue-400 animate-pulse",
  },
  confirmed: {
    label: "Confirmado",
    classes: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
  },
  cancelled: {
    label: "Cancelado",
    classes: "bg-red-100 text-red-600",
    dot: "bg-red-400",
  },
};

function StatusBadge({ status }: { status: ConversationStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.classes}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── MessageBubble ─────────────────────────────────────────────────────────────
function MessageBubble({ message, customer }: { message: Message; customer: string }) {
  const isUser = message.role === "user";

  // Formata quebras de linha e negrito simples (*texto*)
  const formatContent = (text: string) =>
    text.split("\n").map((line, i) => (
      <span key={i}>
        {line.split(/(\*[^*]+\*)/).map((part, j) =>
          part.startsWith("*") && part.endsWith("*") ? (
            <strong key={j}>{part.slice(1, -1)}</strong>
          ) : (
            part
          )
        )}
        {i < text.split("\n").length - 1 && <br />}
      </span>
    ));

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
          isUser
            ? "bg-indigo-600 text-white"
            : "bg-slate-200 text-slate-600"
        }`}
      >
        {isUser ? getInitials(customer) : "IA"}
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "bg-indigo-600 text-white rounded-tr-sm"
              : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
          }`}
        >
          {formatContent(message.content)}
        </div>
        <span className="text-xs text-slate-400 px-1">{formatTime(message.createdAt)}</span>
      </div>
    </div>
  );
}

// ─── TypingIndicator ───────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div className="shrink-0 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
        IA
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── NewClientModal ────────────────────────────────────────────────────────────
function NewClientModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (customer: string, message: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !message.trim() || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      await onCreate(name.trim(), message.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar conversa.");
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Simular novo cliente</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Insira o nome do cliente e o primeiro pedido em linguagem natural.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Nome do cliente
            </label>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Maria Silva"
              disabled={isLoading}
              className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 disabled:bg-slate-50 transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Mensagem do pedido
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex: Quero 10 caixas de leite e 5 fardos de água para amanhã"
              rows={3}
              disabled={isLoading}
              className="resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 disabled:bg-slate-50 transition-all"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !message.trim() || isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {isLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Enviando...
                </>
              ) : (
                "Enviar pedido"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Página Principal ──────────────────────────────────────────────────────────
export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;
  const isConversationClosed =
    selectedConv?.status === "confirmed" ||
    selectedConv?.status === "cancelled";

  // Scroll automático ao receber novas mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConv?.messages.length, isSending]);

  // Busca inicial das conversas
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error();
      const data: Conversation[] = await res.json();
      setConversations(data);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Foca o input ao trocar de conversa
  useEffect(() => {
    if (selectedId && !isConversationClosed) {
      inputRef.current?.focus();
    }
  }, [selectedId, isConversationClosed]);

  // ── Criar nova conversa ──────────────────────────────────────────────────────
  async function handleCreateConversation(customer: string, message: string) {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer, message }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Erro ao criar conversa.");

    setConversations((prev) => [data, ...prev]);
    setSelectedId(data.id);
  }

  // ── Enviar mensagem na conversa selecionada ──────────────────────────────────
  async function handleSendMessage() {
    if (!selectedId || !messageInput.trim() || isSending) return;

    const text = messageInput.trim();
    setMessageInput("");
    setIsSending(true);
    setSendError(null);

    try {
      const res = await fetch(`/api/conversations/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar mensagem.");

      setConversations((prev) =>
        prev.map((c) => (c.id === selectedId ? data : c))
      );
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Erro desconhecido.");
      // Restaura o texto no input em caso de erro
      setMessageInput(text);
    } finally {
      setIsSending(false);
    }
  }

  // Enter envia; Shift+Enter insere quebra de linha
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  // ── Ações rápidas de confirmação ─────────────────────────────────────────────
  async function sendQuickReply(text: string) {
    setMessageInput(text);
    // Pequeno delay para o usuário ver o texto antes de enviar
    setTimeout(() => {
      setMessageInput("");
      setIsSending(true);
      setSendError(null);
      fetch(`/api/conversations/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      })
        .then((res) => res.json())
        .then((data) => {
          setConversations((prev) =>
            prev.map((c) => (c.id === selectedId ? data : c))
          );
        })
        .catch((err) => setSendError(err.message))
        .finally(() => setIsSending(false));
    }, 150);
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-100">
      {/* Modal de novo cliente */}
      {showModal && (
        <NewClientModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreateConversation}
        />
      )}

      {/* ── Layout principal ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ════════════════════════════════════════════════════════════════════
            PAINEL ESQUERDO — Simulador de Clientes
        ════════════════════════════════════════════════════════════════════ */}
        <aside className="w-80 shrink-0 bg-slate-900 flex flex-col border-r border-slate-800">
          {/* Header */}
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="bg-indigo-600 text-white rounded-xl p-2 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-sm font-bold text-white">Central de Pedidos</h1>
                <p className="text-xs text-slate-400">Simulador de clientes</p>
              </div>
              <Link
                href="/admin"
                className="shrink-0 p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                title="Gerenciamento"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              </Link>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Novo Cliente
            </button>
          </div>

          {/* Lista de conversas */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingList ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-slate-800 rounded-xl p-3 animate-pulse">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-slate-700 rounded w-24" />
                        <div className="h-2 bg-slate-700 rounded w-36" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-slate-500 text-sm">Nenhuma conversa ainda.</p>
                <p className="text-slate-600 text-xs mt-1">
                  Clique em "Novo Cliente" para começar.
                </p>
              </div>
            ) : (
              <ul className="p-2 space-y-1">
                {conversations.map((conv) => {
                  const isSelected = conv.id === selectedId;
                  const lastMsg = conv.messages[conv.messages.length - 1];

                  return (
                    <li key={conv.id}>
                      <button
                        onClick={() => {
                          setSelectedId(conv.id);
                          setSendError(null);
                        }}
                        className={`w-full text-left rounded-xl p-3 transition-colors ${
                          isSelected
                            ? "bg-indigo-600"
                            : "hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div
                            className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                              isSelected
                                ? "bg-indigo-400 text-white"
                                : "bg-slate-700 text-slate-300"
                            }`}
                          >
                            {getInitials(conv.customer)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className={`text-sm font-semibold truncate ${
                                  isSelected ? "text-white" : "text-slate-200"
                                }`}
                              >
                                {conv.customer}
                              </span>
                              <span
                                className={`text-xs shrink-0 ${
                                  isSelected ? "text-indigo-200" : "text-slate-500"
                                }`}
                              >
                                {formatRelative(conv.updatedAt)}
                              </span>
                            </div>

                            {lastMsg && (
                              <p
                                className={`text-xs truncate mt-0.5 ${
                                  isSelected ? "text-indigo-200" : "text-slate-500"
                                }`}
                              >
                                {lastMsg.role === "assistant" ? "🤖 " : "👤 "}
                                {lastMsg.content.replace(/\n/g, " ")}
                              </p>
                            )}

                            {/* Status dot */}
                            <div className="mt-1.5">
                              <span
                                className={`inline-flex items-center gap-1 text-xs rounded-full px-1.5 py-0.5 ${
                                  isSelected
                                    ? "bg-indigo-500 text-indigo-100"
                                    : STATUS_CONFIG[conv.status as ConversationStatus].classes
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isSelected
                                      ? "bg-indigo-200"
                                      : STATUS_CONFIG[conv.status as ConversationStatus].dot
                                  }`}
                                />
                                {STATUS_CONFIG[conv.status as ConversationStatus].label}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* ════════════════════════════════════════════════════════════════════
            PAINEL DIREITO — Chat
        ════════════════════════════════════════════════════════════════════ */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {!selectedConv ? (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="bg-slate-200 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-slate-700">
                Nenhuma conversa selecionada
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Selecione um cliente ou crie uma nova simulação.
              </p>
            </div>
          ) : (
            <>
              {/* ── Header do chat ─────────────────────────────────────────── */}
              <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                    {getInitials(selectedConv.customer)}
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900">
                      {selectedConv.customer}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {selectedConv.messages.length}{" "}
                      {selectedConv.messages.length === 1 ? "mensagem" : "mensagens"}
                    </p>
                  </div>
                </div>
                <StatusBadge status={selectedConv.status as ConversationStatus} />
              </div>

              {/* ── Área de mensagens ──────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 bg-slate-50">
                {/* Mensagens */}
                {selectedConv.messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    customer={selectedConv.customer}
                  />
                ))}

                {/* Indicador de digitação da IA */}
                {isSending && <TypingIndicator />}

                <div ref={messagesEndRef} />
              </div>

              {/* ── Área de input ──────────────────────────────────────────── */}
              <div className="shrink-0 bg-white border-t border-slate-200 p-4 flex flex-col gap-3">
                {/* Ações rápidas (apenas quando aguarda confirmação) */}
                {selectedConv.status === "awaiting_confirmation" && !isSending && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => sendQuickReply("Sim, pode confirmar! ✅")}
                      className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Confirmar pedido
                    </button>
                    <button
                      onClick={() => sendQuickReply("Quero cancelar o pedido.")}
                      className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancelar
                    </button>
                    <span className="text-xs text-slate-400 self-center ml-auto">
                      ou escreva uma alteração abaixo
                    </span>
                  </div>
                )}

                {/* Erro de envio */}
                {sendError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {sendError}
                  </p>
                )}

                {/* Input */}
                {isConversationClosed ? (
                  <div className="text-center text-sm text-slate-400 py-2">
                    {selectedConv.status === "confirmed"
                      ? "✅ Pedido confirmado — conversa encerrada."
                      : "❌ Conversa cancelada."}
                  </div>
                ) : (
                  <div className="flex gap-3 items-end">
                    <div className="flex-1 relative">
                      <textarea
                        ref={inputRef}
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={
                          selectedConv.status === "awaiting_confirmation"
                            ? "Confirme ou descreva uma alteração..."
                            : `Simular mensagem de ${selectedConv.customer}...`
                        }
                        rows={2}
                        disabled={isSending}
                        className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 pr-12 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 disabled:bg-slate-50 transition-all"
                      />
                      <span className="absolute bottom-3 right-3 text-xs text-slate-300">
                        ↵
                      </span>
                    </div>
                    <button
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || isSending}
                      className="shrink-0 w-10 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white rounded-xl flex items-center justify-center transition-colors"
                    >
                      {isSending ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
