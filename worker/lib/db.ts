import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import type { Env } from "../types";

let cachedPrisma: PrismaClient | null = null;
let lastConnectionString: string | null = null;

export function getPrisma(env: Env): PrismaClient {
  const connectionString = env.DATABASE_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    if (!cachedPrisma) {
      cachedPrisma = new PrismaClient();
    }
    return cachedPrisma;
  }

  if (cachedPrisma && lastConnectionString === connectionString) {
    return cachedPrisma;
  }

  const pool = new Pool({ connectionString, max: 5 });
  const adapter = new PrismaPg(pool);
  cachedPrisma = new PrismaClient({ adapter });
  lastConnectionString = connectionString;
  return cachedPrisma;
}

