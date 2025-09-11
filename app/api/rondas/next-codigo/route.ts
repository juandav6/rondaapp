// app/api/rondas/next-codigo/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // Saca el siguiente número de la secuencia
  const row = await prisma.$queryRaw<{ nextval: bigint }[]>`
    SELECT nextval('ronda_codigo_seq') as nextval
  `;
  const n = Number(row[0].nextval);
  const codigo = `RD${String(n).padStart(4, "0")}`; // RD0001, RD0002, …

  // OJO: solo lo “previsualiza”, no crea la ronda aún.
  return NextResponse.json({ codigo });
}
