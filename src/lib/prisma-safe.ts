/**
 * Acessores para Product usando SQL direto, contornando o Prisma Client
 * desatualizado. A tabela é criada automaticamente se não existir.
 */
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export type ProductRecord = { id: string; name: string; unit: string | null; createdAt: Date };

// Garante que a tabela Product existe antes de qualquer operação
async function ensureProductTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Product" (
      "id"        TEXT     NOT NULL PRIMARY KEY,
      "name"      TEXT     NOT NULL,
      "unit"      TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE("name")
    )
  `);
}

// ── Produtos ──────────────────────────────────────────────────────────────────

export async function safeGetProducts(): Promise<ProductRecord[]> {
  try {
    await ensureProductTable();
    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: string; name: string; unit: string | null; createdAt: string }>
    >(`SELECT id, name, unit, createdAt FROM "Product" ORDER BY name ASC`);
    return rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt) }));
  } catch {
    return [];
  }
}

export async function safeCreateProduct(data: {
  name: string;
  unit?: string | null;
}): Promise<ProductRecord> {
  await ensureProductTable();
  const id = randomUUID();
  const now = new Date().toISOString();
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Product" (id, name, unit, createdAt) VALUES (?, ?, ?, ?)`,
      id,
      data.name,
      data.unit ?? null,
      now
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("unique")) {
      const err = new Error("Unique constraint failed") as Error & { code: string };
      err.code = "P2002";
      throw err;
    }
    throw e;
  }
  return { id, name: data.name, unit: data.unit ?? null, createdAt: new Date(now) };
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function safeUpsertOrder(data: {
  conversationId: string;
  customer: string;
  rawText: string;
  items: string;          // JSON string
  deliveryDate: string;
  unknownItems: string;   // JSON string
}): Promise<void> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Order" (id, conversationId, customer, rawText, items, deliveryDate, adminStatus, unknownItems, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    ON CONFLICT(conversationId) DO UPDATE SET
      customer     = excluded.customer,
      items        = excluded.items,
      deliveryDate = excluded.deliveryDate,
      unknownItems = excluded.unknownItems,
      updatedAt    = excluded.updatedAt
  `,
    id,
    data.conversationId,
    data.customer,
    data.rawText,
    data.items,
    data.deliveryDate,
    data.unknownItems,
    now,
    now
  );
}

export async function safeUpdateOrderCustomer(conversationId: string, customer: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE "Order" SET customer = ?, updatedAt = ? WHERE conversationId = ?`,
    customer,
    new Date().toISOString(),
    conversationId
  );
}

export async function safeDeleteProduct(id: string): Promise<void> {
  await ensureProductTable();
  const affected = await prisma.$executeRawUnsafe(
    `DELETE FROM "Product" WHERE id = ?`,
    id
  );
  if (affected === 0) {
    const err = new Error("Record not found") as Error & { code: string };
    err.code = "P2025";
    throw err;
  }
}
