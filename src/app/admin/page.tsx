"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

// ─── Tipos ─────────────────────────────────────────────────────────────────────
interface OrderItem {
  produto: string;
  quantidade: number;
}

type AdminStatus = "pending" | "confirmed" | "finalized";

interface Order {
  id: string;
  customer: string;
  items: OrderItem[];
  deliveryDate: string;
  adminStatus: AdminStatus;
  unknownItems: string[];
  conversationStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Product {
  id: string;
  name: string;
  unit: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  AdminStatus,
  { label: string; badge: string; next: AdminStatus | null; nextLabel: string | null; nextBtn: string }
> = {
  pending: {
    label: "Pendente",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    next: "confirmed",
    nextLabel: "Confirmar",
    nextBtn: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  confirmed: {
    label: "Confirmado",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    next: "finalized",
    nextLabel: "Finalizar",
    nextBtn: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  finalized: {
    label: "Finalizado",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    next: null,
    nextLabel: null,
    nextBtn: "",
  },
};

type FilterKey = "all" | AdminStatus;

// ─── Componente: Badge de status ───────────────────────────────────────────────
function StatusBadge({ status }: { status: AdminStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.badge}`}
    >
      {cfg.label}
    </span>
  );
}

// ─── Página Admin ──────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const isFirstOrderFetch = useRef(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Formulário de novo produto
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  // Nome pré-preenchido pelo alerta de item fora de estoque
  const [prefilledAlert, setPrefilledAlert] = useState<string | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    // Só mostra o loading completo na primeira carga; troca de filtro não substitui a tabela
    if (isFirstOrderFetch.current) setIsLoadingOrders(true);
    try {
      // Sempre busca todos — filtragem é feita no frontend para manter contadores corretos
      const res = await fetch("/api/admin/orders");
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } finally {
      isFirstOrderFetch.current = false;
      setIsLoadingOrders(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const res = await fetch("/api/admin/products");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ── Mudar status do pedido ───────────────────────────────────────────────────
  async function handleStatusChange(orderId: string, next: AdminStatus) {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminStatus: next }),
      });
      if (!res.ok) throw new Error();
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, adminStatus: next } : o))
      );
    } finally {
      setUpdatingId(null);
    }
  }

  // ── Adicionar produto ────────────────────────────────────────────────────────
  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || isAddingProduct) return;
    setIsAddingProduct(true);
    setProductError(null);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), unit: newUnit.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao adicionar produto.");
      setProducts((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      setNewUnit("");
      setPrefilledAlert(null);
    } catch (err) {
      setProductError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setIsAddingProduct(false);
    }
  }

  // ── Remover produto ──────────────────────────────────────────────────────────
  async function handleDeleteProduct(id: string) {
    await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  // ── Computed ─────────────────────────────────────────────────────────────────
  const filteredOrders = orders.filter((o) => {
    if (activeFilter !== "all" && o.adminStatus !== activeFilter) return false;
    if (search && !o.customer.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all: orders.length,
    pending: orders.filter((o) => o.adminStatus === "pending").length,
    confirmed: orders.filter((o) => o.adminStatus === "confirmed").length,
    finalized: orders.filter((o) => o.adminStatus === "finalized").length,
  };

  // Itens únicos fora do estoque em pedidos pendentes
  const alertItems = Array.from(
    new Set(
      orders
        .filter((o) => o.adminStatus === "pending" && o.unknownItems.length > 0)
        .flatMap((o) => o.unknownItems)
    )
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white rounded-xl p-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-slate-900 leading-tight">Central de Pedidos</h1>
              <p className="text-xs text-slate-500">Gerenciamento</p>
            </div>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Atendimento
          </Link>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-6 py-8 flex flex-col gap-8">

        {/* ── Alertas de itens fora do estoque ────────────────────────────── */}
        {alertItems.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800 mb-2">
                  Itens pedidos que não estão no catálogo:
                </p>
                <div className="flex flex-wrap gap-2">
                  {alertItems.map((item) => (
                    <button
                      key={item}
                      onClick={() => {
                        setPrefilledAlert(item);
                        setNewName(item);
                        document.getElementById("inventory-section")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="flex items-center gap-1.5 bg-white border border-amber-300 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-lg hover:bg-amber-100 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Pedidos ──────────────────────────────────────────────────────── */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-slate-900">Pedidos</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchOrders}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                title="Atualizar"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente..."
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 w-44"
              />
            </div>
          </div>

          {/* Filtros */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {(["all", "pending", "confirmed", "finalized"] as FilterKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl border transition-colors ${
                  activeFilter === key
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                }`}
              >
                {key === "all" ? "Todos" : STATUS_CONFIG[key as AdminStatus].label}
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    activeFilter === key ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {counts[key]}
                </span>
              </button>
            ))}
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {isLoadingOrders ? (
              <div className="p-8 text-center text-slate-400 text-sm">Carregando pedidos...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-12 text-center">
                <div className="bg-slate-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <p className="text-slate-500 text-sm font-medium">Nenhum pedido encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Itens
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                        Entrega
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                        Criado em
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((order) => {
                      const cfg = STATUS_CONFIG[order.adminStatus];
                      const isUpdating = updatingId === order.id;

                      return (
                        <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                          {/* Cliente */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                                {getInitials(order.customer)}
                              </div>
                              <div>
                                <p className="font-medium text-slate-900">{order.customer}</p>
                                <p className="text-xs text-slate-400">#{order.id.slice(0, 8)}</p>
                              </div>
                            </div>
                          </td>

                          {/* Itens */}
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-0.5">
                              {order.items.map((item, i) => (
                                <span key={i} className="text-slate-700">
                                  <span className="font-semibold text-slate-900">
                                    {item.quantidade}×
                                  </span>{" "}
                                  <span className="capitalize">{item.produto}</span>
                                </span>
                              ))}
                              {order.unknownItems.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {order.unknownItems.map((item) => (
                                    <span
                                      key={item}
                                      className="inline-flex items-center gap-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs px-1.5 py-0.5 rounded"
                                      title="Item fora do catálogo"
                                    >
                                      ⚠️ {item}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Entrega */}
                          <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                            {order.deliveryDate ? formatDate(order.deliveryDate) : (
                              <span className="text-xs text-slate-400 italic">Aguardando</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <StatusBadge status={order.adminStatus} />
                          </td>

                          {/* Criado em */}
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                            {formatDateTime(order.createdAt)}
                          </td>

                          {/* Ações */}
                          <td className="px-4 py-3">
                            {cfg.next && cfg.nextLabel ? (
                              <button
                                onClick={() => handleStatusChange(order.id, cfg.next!)}
                                disabled={isUpdating}
                                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${cfg.nextBtn}`}
                              >
                                {isUpdating ? "..." : cfg.nextLabel}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* ── Catálogo de Produtos (Estoque) ───────────────────────────────── */}
        <section id="inventory-section">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Catálogo de Produtos</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lista de produtos */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-sm font-semibold text-slate-700">
                  Produtos cadastrados ({products.length})
                </p>
              </div>
              {isLoadingProducts ? (
                <div className="p-6 text-center text-sm text-slate-400">Carregando...</div>
              ) : products.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">
                  Nenhum produto cadastrado. Adicione produtos para que a IA possa comparar os pedidos.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {products.map((product) => {
                    const isAlert = alertItems.some(
                      (a) => a.toLowerCase() === product.name.toLowerCase()
                    );
                    return (
                      <li
                        key={product.id}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800 capitalize">
                            {product.name}
                          </span>
                          {product.unit && (
                            <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {product.unit}
                            </span>
                          )}
                          {isAlert && (
                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-200">
                              ✓ resolvido
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all rounded"
                          title="Remover produto"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Formulário de adição */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4 h-fit">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Adicionar produto</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Produtos cadastrados são usados pela IA para comparar e corrigir nomes nos pedidos.
                </p>
              </div>

              {prefilledAlert && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                  Adicionando "<strong>{prefilledAlert}</strong>" a partir do alerta de estoque.
                </div>
              )}

              <form onSubmit={handleAddProduct} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-600">Nome do produto *</label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: café, leite integral, água mineral"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-all"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-600">Unidade (opcional)</label>
                  <input
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    placeholder="Ex: caixa, fardo, kg, litro"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-all"
                  />
                </div>

                {productError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    {productError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!newName.trim() || isAddingProduct}
                  className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
                >
                  {isAddingProduct ? (
                    "Adicionando..."
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Adicionar ao catálogo
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
