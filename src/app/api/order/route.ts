import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// ─── Cliente OpenAI ────────────────────────────────────────────────────────────
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ─── Schema de validação Zod ───────────────────────────────────────────────────
const OrderItemSchema = z.object({
  produto: z.string().min(1, "Nome do produto não pode ser vazio"),
  quantidade: z.number().int().positive("Quantidade deve ser um número positivo"),
});

const ParsedOrderSchema = z.object({
  cliente: z.string().min(1),
  itens: z.array(OrderItemSchema).min(1, "O pedido deve conter ao menos um item"),
  data_entrega: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
});

type ParsedOrder = z.infer<typeof ParsedOrderSchema>;

// ─── System Prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Você é um assistente especializado em estruturar pedidos comerciais em português.
Analise o texto fornecido e extraia as informações do pedido.

Retorne APENAS um objeto JSON válido com a seguinte estrutura:
{
  "cliente": "nome do cliente ou 'desconhecido' se não mencionado",
  "itens": [
    { "produto": "nome do produto", "quantidade": número_inteiro }
  ],
  "data_entrega": "YYYY-MM-DD"
}

Regras:
- "cliente": extraia o nome se mencionado, caso contrário use "desconhecido"
- "itens": liste todos os produtos com suas quantidades como números inteiros
- "data_entrega": converta expressões como "amanhã", "próxima sexta" para o formato YYYY-MM-DD usando a data de hoje como referência
- Se nenhuma data for mencionada, use a data de hoje + 1 dia
- Não inclua nenhum texto fora do JSON`;

// ─── POST /api/order ───────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawText: string = body?.text;

    if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
      return NextResponse.json(
        { error: "O campo 'text' é obrigatório e não pode estar vazio." },
        { status: 400 }
      );
    }

    // ── 1. Chamar a OpenAI ──────────────────────────────────────────────────
    let parsedOrder: ParsedOrder;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Data de hoje: ${new Date().toISOString().split("T")[0]}\n\nPedido: ${rawText}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1, // baixa temperatura para respostas mais determinísticas
      });

      const jsonString = completion.choices[0]?.message?.content;

      if (!jsonString) {
        throw new Error("A IA não retornou uma resposta válida.");
      }

      // ── 2. Validar com Zod ────────────────────────────────────────────────
      const rawJson = JSON.parse(jsonString);
      const validation = ParsedOrderSchema.safeParse(rawJson);

      if (!validation.success) {
        console.error("Zod validation error:", validation.error.flatten());
        return NextResponse.json(
          {
            error: "A IA retornou dados em formato inválido.",
            details: validation.error.flatten().fieldErrors,
          },
          { status: 422 }
        );
      }

      parsedOrder = validation.data;
    } catch (aiError) {
      if (aiError instanceof OpenAI.APIError) {
        console.error("OpenAI API Error:", aiError.status, aiError.message);
        return NextResponse.json(
          { error: `Erro na API de IA: ${aiError.message}` },
          { status: 502 }
        );
      }
      throw aiError; // re-throw erros inesperados
    }

    // ── 3. Salvar no banco com Prisma ─────────────────────────────────────
    const order = await prisma.order.create({
      data: {
        customer: parsedOrder.cliente,
        rawText: rawText.trim(),
        items: JSON.stringify(parsedOrder.itens),
        deliveryDate: parsedOrder.data_entrega,
      },
    });

    return NextResponse.json(
      {
        id: order.id,
        customer: order.customer,
        rawText: order.rawText,
        items: parsedOrder.itens,
        deliveryDate: order.deliveryDate,
        createdAt: order.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error in POST /api/order:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor. Tente novamente." },
      { status: 500 }
    );
  }
}

// ─── GET /api/order ────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
    });

    const serialized = orders.map((order) => ({
      id: order.id,
      customer: order.customer,
      rawText: order.rawText,
      items: JSON.parse(order.items) as Array<{ produto: string; quantidade: number }>,
      deliveryDate: order.deliveryDate,
      createdAt: order.createdAt,
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Unexpected error in GET /api/order:", error);
    return NextResponse.json(
      { error: "Erro ao buscar pedidos." },
      { status: 500 }
    );
  }
}
