import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/setup — cria tabelas e colunas que faltam no banco SQLite
export async function GET() {
  const log: string[] = [];

  // ── Tabela Product ────────────────────────────────────────────────────────────
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Product" (
        "id"        TEXT     NOT NULL PRIMARY KEY,
        "name"      TEXT     NOT NULL UNIQUE,
        "unit"      TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    log.push("✓ Tabela Product OK");
  } catch (e) {
    log.push(`✗ Tabela Product: ${e}`);
  }

  // ── Coluna adminStatus em Order ───────────────────────────────────────────────
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Order" ADD COLUMN "adminStatus" TEXT NOT NULL DEFAULT 'pending'`
    );
    log.push("✓ Coluna adminStatus adicionada");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    log.push(msg.toLowerCase().includes("duplicate") ? "• adminStatus já existe" : `✗ adminStatus: ${msg}`);
  }

  // ── Coluna unknownItems em Order ──────────────────────────────────────────────
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Order" ADD COLUMN "unknownItems" TEXT NOT NULL DEFAULT '[]'`
    );
    log.push("✓ Coluna unknownItems adicionada");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    log.push(msg.toLowerCase().includes("duplicate") ? "• unknownItems já existe" : `✗ unknownItems: ${msg}`);
  }

  // ── Coluna updatedAt em Order ─────────────────────────────────────────────────
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Order" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
    );
    // Preenche linhas existentes com a data de criação
    await prisma.$executeRawUnsafe(
      `UPDATE "Order" SET "updatedAt" = "createdAt" WHERE "updatedAt" = CURRENT_TIMESTAMP`
    );
    log.push("✓ Coluna updatedAt adicionada");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    log.push(msg.toLowerCase().includes("duplicate") ? "• updatedAt já existe" : `✗ updatedAt: ${msg}`);
  }

  // ── Resultado ─────────────────────────────────────────────────────────────────
  const hasError = log.some((l) => l.startsWith("✗"));
  return NextResponse.json(
    { ok: !hasError, log },
    { status: hasError ? 500 : 200 }
  );
}
