import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import type { Env } from "../types";

let prismaInstance: PrismaClient | null = null;

export function getPrisma(env: Env): PrismaClient {
  if (prismaInstance) {
    return prismaInstance;
  }

  const connectionString = env.DATABASE_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    // Return standard PrismaClient fallback for dev/testing
    prismaInstance = new PrismaClient();
    return prismaInstance;
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  prismaInstance = new PrismaClient({ adapter });

  return prismaInstance;
}
