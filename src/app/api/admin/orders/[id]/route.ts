import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureOrderColumns } from "@/lib/migrate";

const VALID_TRANSITIONS: Record<string, string> = {
  pending: "confirmed",
  confirmed: "finalized",
};

const PatchBody = z.object({
  adminStatus: z.enum(["pending", "confirmed", "finalized"]),
});

type RawOrderStatus = { id: string; adminStatus: string | null };

// ─── PATCH /api/admin/orders/:id ───────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureOrderColumns();

    const body = await request.json();
    const parsed = PatchBody.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "adminStatus inválido. Use: pending, confirmed ou finalized." },
        { status: 400 }
      );
    }

    const [order] = await prisma.$queryRawUnsafe<RawOrderStatus[]>(
      `SELECT id, adminStatus FROM "Order" WHERE id = ?`,
      params.id
    );

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    const currentStatus = order.adminStatus ?? "pending";
    const allowed = VALID_TRANSITIONS[currentStatus];

    if (parsed.data.adminStatus !== allowed) {
      return NextResponse.json(
        {
          error: `Transição inválida: "${currentStatus}" → "${parsed.data.adminStatus}". Próximo permitido: "${allowed}".`,
        },
        { status: 422 }
      );
    }

    const now = new Date().toISOString();
    await prisma.$executeRawUnsafe(
      `UPDATE "Order" SET adminStatus = ?, updatedAt = ? WHERE id = ?`,
      parsed.data.adminStatus,
      now,
      params.id
    );

    return NextResponse.json({
      id: params.id,
      adminStatus: parsed.data.adminStatus,
      updatedAt: now,
    });
  } catch (error) {
    console.error(`PATCH /api/admin/orders/${params.id}:`, error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
