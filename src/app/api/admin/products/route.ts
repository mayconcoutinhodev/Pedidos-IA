import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeGetProducts, safeCreateProduct } from "@/lib/prisma-safe";

const CreateProductBody = z.object({
  name: z.string().min(1).max(100),
  unit: z.string().max(30).optional(),
});

// ─── GET /api/admin/products ───────────────────────────────────────────────────
export async function GET() {
  try {
    const products = await safeGetProducts();
    return NextResponse.json(products);
  } catch (error) {
    console.error("GET /api/admin/products:", error);
    return NextResponse.json({ error: "Erro ao buscar produtos." }, { status: 500 });
  }
}

// ─── POST /api/admin/products ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateProductBody.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const product = await safeCreateProduct({
      name: parsed.data.name.trim(),
      unit: parsed.data.unit?.trim() || null,
    });

    if (!product) {
      return NextResponse.json(
        { error: "Catálogo de produtos indisponível. Aguarde a regeneração do Prisma Client." },
        { status: 503 }
      );
    }

    return NextResponse.json(product, { status: 201 });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Já existe um produto com este nome." },
        { status: 409 }
      );
    }
    console.error("POST /api/admin/products:", error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
