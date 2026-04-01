import { NextRequest, NextResponse } from "next/server";
import { safeDeleteProduct } from "@/lib/prisma-safe";

// ─── DELETE /api/admin/products/:id ───────────────────────────────────────────
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await safeDeleteProduct(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
    }
    console.error(`DELETE /api/admin/products/${params.id}:`, error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
