import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { processConversation } from "@/lib/ai";
import { getUnknownItems } from "@/lib/inventory";
import { safeGetProducts, safeUpsertOrder } from "@/lib/prisma-safe";

function serializeConversation(conv: {
  id: string;
  customer: string;
  status: string;
  currentOrder: string | null;
  createdAt: Date;
  updatedAt: Date;
  messages: Array<{ id: string; role: string; content: string; createdAt: Date }>;
}) {
  return {
    id: conv.id,
    customer: conv.customer,
    status: conv.status,
    currentOrder: conv.currentOrder ? JSON.parse(conv.currentOrder) : null,
    messages: conv.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString(),
  };
}

// ─── GET /api/conversations ────────────────────────────────────────────────────
export async function GET() {
  try {
    const conversations = await prisma.conversation.findMany({
      include: { messages: { orderBy: { createdAt: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(conversations.map(serializeConversation));
  } catch (error) {
    console.error("GET /api/conversations:", error);
    return NextResponse.json({ error: "Erro ao buscar conversas." }, { status: 500 });
  }
}

// ─── POST /api/conversations ───────────────────────────────────────────────────
// Body: { customer: string, message: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const customer: string = body?.customer?.trim();
    const message: string = body?.message?.trim();

    if (!customer || !message) {
      return NextResponse.json(
        { error: "Os campos 'customer' e 'message' são obrigatórios." },
        { status: 400 }
      );
    }

    // 1. Cria conversa com a primeira mensagem
    const conversation = await prisma.conversation.create({
      data: {
        customer,
        status: "collecting",
        messages: { create: { role: "user", content: message } },
      },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    // 2. Busca produtos do catálogo (seguro: retorna [] se o model ainda não existe no client)
    const products = await safeGetProducts();
    const productNames = products.map((p) => p.name);

    // 3. Chama a IA
    const history = conversation.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    let aiResponse;
    try {
      aiResponse = await processConversation(history, productNames, customer);
    } catch (err) {
      if (err instanceof OpenAI.APIError) {
        return NextResponse.json({ error: `Erro na API de IA: ${err.message}` }, { status: 502 });
      }
      throw err;
    }

    // 4. Se a IA detectou um nome real, atualiza o nome do cliente
    const finalCustomer = aiResponse.updatedCustomerName?.trim() || customer;

    // 5. Salva resposta da IA e atualiza conversa
    const updated = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        customer: finalCustomer,
        status: aiResponse.status,
        currentOrder: aiResponse.order ? JSON.stringify(aiResponse.order) : null,
        messages: { create: { role: "assistant", content: aiResponse.reply } },
      },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    // 6. Cria/atualiza Order — sempre, desde a primeira mensagem
    try {
      const orderData =
        aiResponse.order ??
        (updated.currentOrder ? JSON.parse(updated.currentOrder) : null);
      const unknownItems = getUnknownItems(orderData?.itens ?? [], productNames);
      await safeUpsertOrder({
        conversationId: conversation.id,
        customer: finalCustomer,
        rawText: message,
        items: JSON.stringify(orderData?.itens ?? []),
        deliveryDate: orderData?.data_entrega ?? "",
        unknownItems: JSON.stringify(unknownItems),
      });
    } catch (orderErr) {
      console.error("Erro ao gravar Order:", orderErr);
    }

    return NextResponse.json(serializeConversation(updated), { status: 201 });
  } catch (error) {
    console.error("POST /api/conversations:", error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
