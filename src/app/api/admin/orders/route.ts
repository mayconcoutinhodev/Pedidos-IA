import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureOrderColumns } from "@/lib/migrate";
import { safeGetProducts } from "@/lib/prisma-safe";
import { getUnknownItems } from "@/lib/inventory";

type RawOrder = {
  id: string;
  conversationId: string | null;
  customer: string;
  items: string;
  deliveryDate: string;
  adminStatus: string | null;
  unknownItems: string | null;
  createdAt: string;
  updatedAt: string | null;
  conversationStatus: string | null;
};

// ─── GET /api/admin/orders?status=pending|confirmed|finalized ─────────────────
export async function GET(request: NextRequest) {
  try {
    await ensureOrderColumns();

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");
    const search = searchParams.get("search")?.trim().toLowerCase();

    // Busca catálogo atual para recalcular unknownItems dinamicamente
    const products = await safeGetProducts();
    const productNames = products.map((p) => p.name);

    // SQL direto para buscar todas as colunas (incluindo as novas)
    const rows = await prisma.$queryRawUnsafe<RawOrder[]>(`
      SELECT
        o.id, o.conversationId, o.customer, o.items, o.deliveryDate,
        o.adminStatus, o.unknownItems, o.createdAt, o.updatedAt,
        c.status AS conversationStatus
      FROM "Order" o
      LEFT JOIN "Conversation" c ON o.conversationId = c.id
      ORDER BY o.createdAt DESC
    `);

    const serialized = rows
      .map((order) => {
        let items: Array<{ produto: string; quantidade: number }> = [];
        try { items = JSON.parse(order.items); } catch { /* mantém [] */ }

        // Recalcula unknownItems com base no catálogo atual (reflete produtos recém-adicionados)
        const unknownItems = productNames.length > 0
          ? getUnknownItems(items, productNames)
          : [];

        return {
          id: order.id,
          customer: order.customer,
          items,
          deliveryDate: order.deliveryDate,
          adminStatus: (order.adminStatus ?? "pending") as "pending" | "confirmed" | "finalized",
          unknownItems,
          conversationStatus: order.conversationStatus ?? null,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt ?? order.createdAt,
        };
      })
      .filter((order) => {
        if (statusFilter && order.adminStatus !== statusFilter) return false;
        if (search && !order.customer.toLowerCase().includes(search)) return false;
        return true;
      });

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("GET /api/admin/orders:", error);
    return NextResponse.json({ error: "Erro ao buscar pedidos." }, { status: 500 });
  }
}
