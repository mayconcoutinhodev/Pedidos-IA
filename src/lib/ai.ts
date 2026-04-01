import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Schema de validação Zod ───────────────────────────────────────────────────
export const AIResponseSchema = z.object({
  reply: z.string().min(1),
  order: z
    .object({
      cliente: z.string().min(1),
      itens: z
        .array(
          z.object({
            produto: z.string().min(1),
            quantidade: z.number().int().positive(),
          })
        )
        .min(1),
      // null enquanto a data ainda não foi informada
      data_entrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    })
    .nullable(),
  status: z.enum(["collecting", "awaiting_confirmation", "confirmed", "cancelled"]),
  // Preenchido pela IA quando o cliente informa o nome real após validação
  updatedCustomerName: z.string().nullable().optional(),
});

export type AIResponse = z.infer<typeof AIResponseSchema>;
export type OrderData = NonNullable<AIResponse["order"]>;

// ─── Construção dinâmica do system prompt ─────────────────────────────────────
function buildSystemPrompt(products: string[], customerName?: string): string {
  const catalogSection =
    products.length > 0
      ? `\n\nCATÁLOGO INTERNO (uso exclusivo do sistema — NUNCA mencione ao cliente):\n${products
          .map((p) => `  - ${p}`)
          .join("\n")}\n\nCORRESPONDÊNCIA SILENCIOSA: Se o cliente digitar "cafe", use "café" do catálogo internamente. Se o item não existir no catálogo, inclua-o com o nome que o cliente usou — SEM avisar o cliente, SEM dizer que o item não está disponível, SEM sugerir substituições. Aceite tudo normalmente.`
      : "";

  const nameRule = customerName
    ? `\n\nNOME DO CLIENTE: "${customerName}" — já registrado pelo sistema. NÃO peça o nome. Use-o diretamente no campo "cliente" do JSON.`
    : `\n\nNOME DO CLIENTE: não informado ainda. Peça o nome se o cliente não o informar na conversa (apenas se for puramente numérico ou apenas emojis, peça um nome real).`;

  return `Você é um atendente virtual de pedidos em português do Brasil.${catalogSection}${nameRule}

VALIDAÇÃO DE DATA DE ENTREGA:
- Expressões como "hoje", "pra hoje", "amanhã", "depois de amanhã", "semana que vem", "na sexta" SÃO datas válidas — converta para YYYY-MM-DD usando a DATA DE HOJE fornecida abaixo.
- Só pergunte a data se o cliente não tiver mencionado absolutamente nenhuma referência temporal.
- Enquanto a data não for informada, mantenha status "collecting" e data_entrega como null.

FLUXO DE ATENDIMENTO:
1. Se falta data → pergunte (status: "collecting"). Nome já está resolvido, não pergunte.
2. Tem itens + data → apresente resumo e aguarde confirmação (status: "awaiting_confirmation")
   ⚠️ CRÍTICO: Analise TODO o histórico da conversa. Se o cliente já informou itens e data em mensagens anteriores e só faltava o nome, vá DIRETO ao resumo agora — não repita perguntas já respondidas.
3. Cliente confirma → finalize (status: "confirmed") — OBRIGATÓRIO: repita o objeto "order" completo, nunca envie order: null
4. Cliente pede alteração → atualize e apresente novo resumo (status: "awaiting_confirmation")
5. Cliente cancela → status: "cancelled"

⚠️ NUNCA responda apenas "Perfeito!" ou "Obrigado!" sem avançar o fluxo. Toda resposta deve ou pedir uma informação faltante OU apresentar o resumo OU confirmar o pedido.

FORMATO DE RESPOSTA — retorne APENAS JSON válido, sem nenhum texto fora do JSON:
{
  "reply": "mensagem em português para o cliente",
  "order": {
    "cliente": "nome real do cliente",
    "itens": [{ "produto": "nome do produto", "quantidade": número_inteiro }],
    "data_entrega": "YYYY-MM-DD" | null
  } | null,
  "status": "collecting" | "awaiting_confirmation" | "confirmed" | "cancelled",
  "updatedCustomerName": "nome real" | null
}

AO APRESENTAR O PEDIDO PARA CONFIRMAÇÃO, use este formato no campo "reply":
"Perfeito! Aqui está o resumo do seu pedido:\\n\\n📦 *Itens:*\\n• Nx PRODUTO\\n...\\n\\n📅 *Entrega:* [data por extenso em pt-BR]\\n\\nTudo certo? ✅ Confirme ou me diga o que precisa alterar!"`;
}

// ─── Função principal ──────────────────────────────────────────────────────────
export async function processConversation(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  products: string[] = [],
  customerName?: string
): Promise<AIResponse> {
  const today = new Date().toISOString().split("T")[0];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `${buildSystemPrompt(products, customerName)}\n\nDATA DE HOJE: ${today}`,
      },
      ...history,
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const jsonString = completion.choices[0]?.message?.content;
  if (!jsonString) throw new Error("A IA não retornou conteúdo.");

  const raw = JSON.parse(jsonString);
  const result = AIResponseSchema.safeParse(raw);

  if (!result.success) {
    console.error("Zod validation failed:", result.error.flatten());
    throw new Error("A IA retornou um formato de resposta inválido.");
  }

  return result.data;
}
