const MAX_OFF_TOPIC = 3;

// conversationId -> número de tentativas fora do tema
const offTopicCounts = new Map<string, number>();
// conversationId -> bloqueado permanentemente nesta sessão
const blockedConversations = new Set<string>();

// Palavras-chave que indicam mensagem relacionada a pedidos
const ORDER_KEYWORDS = [
  "pedido", "produto", "item", "quero", "preciso", "gostaria", "entreg",
  "data", "prazo", "amanhã", "hoje", "semana", "segunda", "terça", "quarta",
  "quinta", "sexta", "sábado", "domingo", "proxim", "próxim",
  "kg", "kilo", "quilo", "caixa", "fardo", "litro", "pacote", "unidade", "dúzia",
  "sim", "não", "nao", "ok", "confirmo", "confirmar", "cancela", "cancelar",
  "alterar", "mudar", "trocar", "remover", "adicionar",
  "compra", "comprar", "pedir", "lista",
  "oi", "olá", "bom dia", "boa tarde", "boa noite", "tudo bem",
  "quantidade", "quanto", "quantos",
];

// Padrões que indicam claramente mensagem fora do tema
const OFF_TOPIC_PATTERNS = [
  /quem (é|foi|são|eram|seria)\b/i,
  /\b(presidente|governador|prefeito|rei|rainha|papa)\b/i,
  /o que (é|são|foi|eram|significa|quer dizer)\b/i,
  /qual (é|a|o|são) (capital|historia|história|significado|origem)\b/i,
  /\b(politica|política|futebol|esporte|noticia|notícia|novela|filme|música|musica)\b/i,
  /\b(receita|culinaria|culinária|dieta|exercicio|exercício|saúde|saude)\b/i,
  /me (conta|fale|explique|explica|diga) (sobre|a|o|um|uma)/i,
  /\b(traduz|tradução|traducao|sinônimo|sinonimo|definição|definicao)\b/i,
  /\b(piada|história|anedota|poesia|poema|conto|curiosidade)\b/i,
  /\b(tempo|clima|temperatura|previsão|previsao)\b/i,
  /\b(matemática|matematica|calcula|resolv)\b.*\b(\d+.*\d+)\b/i,
];

export interface TopicCheckResult {
  isOffTopic: boolean;
  attemptsLeft: number;
  blocked: boolean;
  warningMessage?: string;
}

export function isConversationBlocked(conversationId: string): boolean {
  return blockedConversations.has(conversationId);
}

export function checkTopic(conversationId: string, message: string): TopicCheckResult {
  // Se já está bloqueado, retorna imediatamente
  if (blockedConversations.has(conversationId)) {
    return { isOffTopic: true, attemptsLeft: 0, blocked: true };
  }

  const normalized = message.toLowerCase().trim();

  // Mensagens curtas (confirmações, respostas simples) são sempre aceitas
  if (normalized.length < 15) {
    const current = offTopicCounts.get(conversationId) ?? 0;
    return { isOffTopic: false, attemptsLeft: MAX_OFF_TOPIC - current, blocked: false };
  }

  // Se contém palavra-chave de pedido, é válida
  const hasOrderKeyword = ORDER_KEYWORDS.some((kw) => normalized.includes(kw));
  if (hasOrderKeyword) {
    const current = offTopicCounts.get(conversationId) ?? 0;
    return { isOffTopic: false, attemptsLeft: MAX_OFF_TOPIC - current, blocked: false };
  }

  // Verifica padrões de fora do tema
  const matchesOffTopic = OFF_TOPIC_PATTERNS.some((pattern) => pattern.test(normalized));
  if (!matchesOffTopic) {
    const current = offTopicCounts.get(conversationId) ?? 0;
    return { isOffTopic: false, attemptsLeft: MAX_OFF_TOPIC - current, blocked: false };
  }

  // Mensagem fora do tema detectada — incrementa contador
  const current = offTopicCounts.get(conversationId) ?? 0;
  const newCount = current + 1;
  offTopicCounts.set(conversationId, newCount);
  const attemptsLeft = Math.max(0, MAX_OFF_TOPIC - newCount);

  if (newCount >= MAX_OFF_TOPIC) {
    blockedConversations.add(conversationId);
    return {
      isOffTopic: true,
      attemptsLeft: 0,
      blocked: true,
      warningMessage:
        "Você excedeu o limite de mensagens fora do tema. Esta conversa foi bloqueada. Por favor, inicie uma nova conversa para fazer um pedido.",
    };
  }

  return {
    isOffTopic: true,
    attemptsLeft,
    blocked: false,
    warningMessage: `Só consigo ajudar com pedidos de produtos. Tentativas restantes antes do bloqueio: ${attemptsLeft}.`,
  };
}
