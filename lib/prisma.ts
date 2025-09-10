// lib/prisma.ts
/* eslint-disable @typescript-eslint/no-var-requires */
import type { PrismaClient as PrismaClientType } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientType };

// tomamos la clase desde require, pero conservamos los tipos
const PrismaPkg = require("@prisma/client");
const PrismaClient: new (...args: any[]) => PrismaClientType = PrismaPkg.PrismaClient;

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["error", "warn"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
