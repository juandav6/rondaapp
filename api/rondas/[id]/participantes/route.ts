// app/api/rondas/[id]/participantes/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const rondaId = Number(params.id);
  const { sociosIds } = await req.json(); // [number]

  const ronda = await prisma.ronda.findUnique({ where: { id: rondaId } });
  if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

  // sorteo simple
  const ordenAleatorio = [...sociosIds].sort(() => Math.random() - 0.5);

  // Crea participaciones (si ya existen, primero borra o usa upsert)
  await prisma.participacion.deleteMany({ where: { rondaId } });
  await prisma.participacion.createMany({
    data: ordenAleatorio.map((socioId, idx) => ({
      rondaId,
      socioId,
      orden: idx + 1,
    })),
  });

  const participantes = await prisma.participacion.findMany({
    where: { rondaId },
    include: { socio: true },
    orderBy: { orden: "asc" },
  });

  return NextResponse.json({
    ok: true,
    participantes: participantes.map((p: { id: any; orden: any; socioId: any; socio: { nombres: any; apellidos: any; numeroCuenta: any; }; }) => ({
      id: p.id,
      orden: p.orden,
      socio: {
        id: p.socioId,
        nombres: p.socio.nombres,
        apellidos: p.socio.apellidos,
        numeroCuenta: p.socio.numeroCuenta,
      },
    })),
  });
}
