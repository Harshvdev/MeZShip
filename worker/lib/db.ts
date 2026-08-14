import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import type { Env } from "../types";

export function getPrisma(env: Env): PrismaClient {
  const connectionString = env.DATABASE_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    return new PrismaClient();
  }

  const pool = new Pool({ connectionString, max: 2 });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

