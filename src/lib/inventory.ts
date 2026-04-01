/**
 * Utilitários de correspondência fuzzy para o catálogo de produtos.
 *
 * Normaliza texto removendo acentos, pontuação e espaços extras para que
 * "cafe" e "café", "leite integral" e "Leite Integral" sejam considerados iguais.
 */

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // remove diacríticos (café → cafe)
    .replace(/[^a-z0-9\s]/g, "")      // remove pontuação
    .replace(/\s+/g, " ");             // normaliza espaços
}

/**
 * Verifica se dois nomes de produto são semanticamente iguais ou um contém o outro.
 * Exemplos que retornam true:
 *   "cafe"     ↔ "café"
 *   "agua"     ↔ "água mineral"
 *   "leite"    ↔ "Leite Integral"
 */
export function isMatch(requested: string, productName: string): boolean {
  const a = normalizeText(requested);
  const b = normalizeText(productName);
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Encontra o produto no catálogo que melhor corresponde ao nome solicitado.
 * Retorna o nome oficial do produto ou null se não houver correspondência.
 */
export function findBestMatch(
  requested: string,
  productNames: string[]
): string | null {
  // Primeiro: correspondência exata após normalização
  for (const name of productNames) {
    if (normalizeText(requested) === normalizeText(name)) return name;
  }
  // Segundo: correspondência por substring
  for (const name of productNames) {
    if (isMatch(requested, name)) return name;
  }
  return null;
}

/**
 * Retorna os itens do pedido que não possuem correspondência no catálogo.
 */
export function getUnknownItems(
  items: Array<{ produto: string }>,
  productNames: string[]
): string[] {
  return items
    .filter((item) => !findBestMatch(item.produto, productNames))
    .map((item) => item.produto);
}
