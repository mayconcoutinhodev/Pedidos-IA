import { PrismaClient } from "@prisma/client";

// Singleton pattern: evita múltiplas instâncias do PrismaClient em desenvolvimento
// devido ao hot-reload do Next.js, que recarrega módulos mas mantém o estado global.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
