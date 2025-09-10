import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

type AporteLite = { socioId: number; monto: Decimal; multa: Decimal };
type Context = { params: Promise<{ id: string; n: string }> };

export async function GET(_req: Request, context: Context) {
  const { params } = await context;
  const rondaId = Number((await params).id);
  const semana = Number((await params).n);

  const ronda = await prisma.ronda.findUnique({
    where: { id: rondaId },
    include: {
      participaciones: { include: { socio: true }, orderBy: { orden: "asc" } },
    },
  });
  if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });

  const aportes = (await prisma.aporte.findMany({
    where: { rondaId, semana },
    select: { socioId: true, monto: true, multa: true },
  })) as AporteLite[];

  const bySocio: Record<number, AporteLite> = {};
  for (const a of aportes) bySocio[a.socioId] = a;

  const items = ronda.participaciones.map((p) => {
    const a = bySocio[p.socioId];
    return {
      participacionId: p.id,
      socioId: p.socioId,
      socio: {
        nombres: p.socio.nombres,
        apellidos: p.socio.apellidos,
        numeroCuenta: p.socio.numeroCuenta,
      },
      orden: p.orden,
      pagado: !!a,
      monto: a ? a.monto.toString() : null,
      multa: a ? a.multa.toString() : "0",
    };
  });

  return NextResponse.json({
    ronda: {
      id: ronda.id,
      nombre: ronda.nombre,
      semanaActual: ronda.semanaActual,
      montoAporte: ronda.montoAporte.toString(),
    },
    semana,
    totalParticipantes: ronda.participaciones.length, // 👈 NUEVO
    items,
  });
}
