/**
 * Aplica migrações pendentes no banco SQLite sem precisar do prisma generate.
 * Chamado automaticamente pelas rotas que dependem dos novos campos.
 */
import { prisma } from "@/lib/prisma";

let migrated = false;

export async function ensureOrderColumns() {
  if (migrated) return;
  migrated = true;

  for (const [col, def] of [
    ["adminStatus", `TEXT NOT NULL DEFAULT 'pending'`],
    ["unknownItems", `TEXT NOT NULL DEFAULT '[]'`],
    ["updatedAt",   `DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`],
  ] as const) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "Order" ADD COLUMN "${col}" ${def}`
      );
    } catch {
      // "duplicate column name" → coluna já existe, ignorar
    }
  }
}
