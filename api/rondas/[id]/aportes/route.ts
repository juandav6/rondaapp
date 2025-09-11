import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

type AporteLite = { socioId: number; monto: Decimal; multa: Decimal };

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const rondaId = Number(params.id);

  const { searchParams } = new URL(req.url);
  const semana = Number(searchParams.get("semana"));

  const ronda = await prisma.ronda.findUnique({
    where: { id: rondaId },
    select: {
      id: true,
      nombre: true,
      semanaActual: true,
      montoAporte: true,
      ahorroObjetivoPorSocio: true,
      participaciones: {
        select: {
          id: true,
          orden: true,
          socioId: true,
          socio: true,
        },
        orderBy: { orden: "asc" },
      },
    },
  });

  if (!ronda) {
    return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
  }

  const aportes = (await prisma.aporte.findMany({
    where: { rondaId, semana },
    select: { socioId: true, monto: true, multa: true },
  })) as AporteLite[];

  const ahorroAgg = await prisma.ahorro.groupBy({
    by: ["socioId"],
    where: { rondaId, semana: { lte: semana } },
    _sum: { monto: true },
  });

  const ahorroBySocio: Record<number, Decimal> = {};
  for (const a of ahorroAgg) {
    ahorroBySocio[a.socioId] = a._sum.monto ?? new Decimal(0);
  }

  const aporteBySocio: Record<number, AporteLite> = {};
  for (const a of aportes) aporteBySocio[a.socioId] = a;

  const items = ronda.participaciones.map((p) => {
    const ap = aporteBySocio[p.socioId];
    const ah = ahorroBySocio[p.socioId] ?? new Decimal(0);

    const objetivo = new Decimal(ronda.ahorroObjetivoPorSocio ?? 0);
    const restante = objetivo.minus(ah);
    const restanteStr = (restante.lessThan(0) ? new Decimal(0) : restante).toString();

    return {
      participacionId: p.id,
      socioId: p.socioId,
      socio: {
        nombres: p.socio.nombres,
        apellidos: p.socio.apellidos,
        numeroCuenta: p.socio.numeroCuenta,
      },
      orden: p.orden,
      pagado: !!ap,
      monto: ap ? ap.monto.toString() : null,
      multa: ap ? ap.multa.toString() : "0",
      ahorroAcumulado: ah.toString(),
      ahorroRestante: restanteStr,
    };
  });

  return NextResponse.json({
    ronda: {
      id: ronda.id,
      nombre: ronda.nombre,
      semanaActual: ronda.semanaActual,
      montoAporte: ronda.montoAporte.toString(),
      ahorroObjetivoPorSocio: ronda.ahorroObjetivoPorSocio.toString(),
    },
    semana,
    totalParticipantes: ronda.participaciones.length,
    items,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const rondaId = Number(params.id);
  const { socioId, semana, monto, multa } = await req.json();

  if (!socioId || !semana || monto == null) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const ronda = await prisma.ronda.findUnique({ where: { id: rondaId } });
  if (!ronda) {
    return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
  }

  const reg = await prisma.aporte.upsert({
    where: { rondaId_socioId_semana: { rondaId, socioId, semana } },
    update: { monto, multa },
    create: { rondaId, socioId, semana, monto, multa },
  });

  return NextResponse.json({
    id: reg.id,
    socioId,
    semana,
    monto: reg.monto.toString(),
    multa: reg.multa.toString(),
  });
}
