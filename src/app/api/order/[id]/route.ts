import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ─── GET /api/order/:id ────────────────────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: params.id },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      id: order.id,
      customer: order.customer,
      rawText: order.rawText,
      items: JSON.parse(order.items) as Array<{ produto: string; quantidade: number }>,
      deliveryDate: order.deliveryDate,
      createdAt: order.createdAt,
    });
  } catch (error) {
    console.error(`Unexpected error in GET /api/order/${params.id}:`, error);
    return NextResponse.json({ error: "Erro ao buscar pedido." }, { status: 500 });
  }
}
