import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { processConversation } from "@/lib/ai";
import { getUnknownItems } from "@/lib/inventory";
import { safeGetProducts, safeUpsertOrder, safeUpdateOrderCustomer } from "@/lib/prisma-safe";

// ─── POST /api/conversations/:id/messages ─────────────────────────────────────
// Body: { message: string }
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const message: string = body?.message?.trim();

    if (!message) {
      return NextResponse.json({ error: "O campo 'message' é obrigatório." }, { status: 400 });
    }

    // 1. Carrega a conversa com histórico
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    }

    if (conversation.status === "confirmed" || conversation.status === "cancelled") {
      return NextResponse.json({ error: "Esta conversa já foi encerrada." }, { status: 409 });
    }

    // 2. Busca produtos do catálogo (seguro: retorna [] se o model ainda não existe no client)
    const products = await safeGetProducts();
    const productNames = products.map((p) => p.name);

    // 3. Monta histórico completo (mensagens anteriores + nova mensagem)
    const history = [
      ...conversation.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    // 4. Chama a IA
    let aiResponse;
    try {
      aiResponse = await processConversation(history, productNames, conversation.customer);
    } catch (err) {
      if (err instanceof OpenAI.APIError) {
        return NextResponse.json({ error: `Erro na API de IA: ${err.message}` }, { status: 502 });
      }
      throw err;
    }

    // 5. Determina o nome final do cliente
    const finalCustomer = aiResponse.updatedCustomerName?.trim() || conversation.customer;

    // 6. Salva mensagem do usuário + resposta da IA + atualiza conversa
    const updated = await prisma.conversation.update({
      where: { id: params.id },
      data: {
        customer: finalCustomer,
        status: aiResponse.status,
        // Mantém o pedido atual se a IA não retornou um novo
        currentOrder: aiResponse.order
          ? JSON.stringify(aiResponse.order)
          : conversation.currentOrder,
        messages: {
          create: [
            { role: "user", content: message },
            { role: "assistant", content: aiResponse.reply },
          ],
        },
      },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    // 7. Cria/atualiza Order — sempre, em toda mensagem
    try {
      const orderData =
        aiResponse.order ??
        (conversation.currentOrder ? JSON.parse(conversation.currentOrder) : null);
      const firstUserMsg =
        conversation.messages.find((m) => m.role === "user")?.content ?? message;
      const unknownItems = getUnknownItems(orderData?.itens ?? [], productNames);
      await safeUpsertOrder({
        conversationId: params.id,
        customer: finalCustomer,
        rawText: firstUserMsg,
        items: JSON.stringify(orderData?.itens ?? []),
        deliveryDate: orderData?.data_entrega ?? "",
        unknownItems: JSON.stringify(unknownItems),
      });
    } catch (orderErr) {
      console.error("Erro ao gravar Order:", orderErr);
    }

    // 8. Se o nome foi atualizado e já existe um Order, atualiza o nome lá também
    if (aiResponse.updatedCustomerName) {
      safeUpdateOrderCustomer(params.id, finalCustomer).catch(() => {/* ignorar */});
    }

    return NextResponse.json({
      id: updated.id,
      customer: updated.customer,
      status: updated.status,
      currentOrder: updated.currentOrder ? JSON.parse(updated.currentOrder) : null,
      messages: updated.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error(`POST /api/conversations/${params.id}/messages:`, error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
