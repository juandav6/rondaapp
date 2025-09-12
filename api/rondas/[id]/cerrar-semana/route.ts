import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const MULTA_BASE = 100;

export async function POST(
  _req: Request,
  context: { params: { id: string } }
) {
  const rondaId = Number(context.params.id);

  const ronda = await prisma.ronda.findUnique({
    where: { id: rondaId },
    include: {
      participaciones: { select: { socioId: true } },
    },
  });

  if (!ronda) {
    return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
  }
  if (!ronda.activa) {
    return NextResponse.json({ error: "Ronda no activa" }, { status: 400 });
  }

  const semana = ronda.semanaActual;
  const participantes = ronda.participaciones.map((p) => p.socioId);

  const pagos = await prisma.aporte.findMany({
    where: { rondaId, semana },
    select: { socioId: true },
  });
  const pagaron = new Set(pagos.map((p) => p.socioId));

  const pendientesIds = participantes.filter((socioId) => !pagaron.has(socioId));

  if (pendientesIds.length > 0) {
    const socios = await prisma.socio.findMany({
      where: { id: { in: pendientesIds } },
      select: { id: true, nombres: true, apellidos: true, numeroCuenta: true },
    });

    const pendientes = socios.map((s) => ({
      socioId: s.id,
      socio: {
        nombres: s.nombres,
        apellidos: s.apellidos,
        numeroCuenta: s.numeroCuenta,
      },
      montoAporte: ronda.montoAporte.toString(),
      multa: MULTA_BASE.toFixed(2),
      totalAdeudado: (Number(ronda.montoAporte) + MULTA_BASE).toFixed(2),
    }));

    return NextResponse.json({ ok: true, avanzada: false, pendientes });
  }

  const totalSemanas = participantes.length;
  const siguiente = semana + 1;

  if (siguiente > totalSemanas) {
    await prisma.ronda.update({
      where: { id: rondaId },
      data: { activa: false, fechaFin: new Date() },
    });
    return NextResponse.json({ ok: true, avanzada: true, finalizada: true });
  }

  await prisma.ronda.update({
    where: { id: rondaId },
    data: { semanaActual: siguiente },
  });

  return NextResponse.json({ ok: true, avanzada: true, finalizada: false });
}
