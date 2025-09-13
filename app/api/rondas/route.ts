// app/api/rondas/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
export const runtime = "nodejs";
import { Prisma } from "@prisma/client";

// helper: convierte "YYYY-MM-DD" a un Date anclado a 12:00 UTC (evita saltos de día por TZ)
function dateOnlyToUTCNoon(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
}

// GET → ronda activa + participaciones + código
export async function GET() {
  const ronda = await prisma.ronda.findFirst({
    where: { activa: true },
    include: {
      participaciones: {
        include: { socio: true },
        orderBy: { orden: "asc" },
      },
    },
  });
  if (!ronda) return new NextResponse(null, { status: 204 });

  return NextResponse.json({
    id: ronda.id,
    nombre: ronda.nombre,
    semanaActual: ronda.semanaActual,
    montoAporte: ronda.montoAporte.toString(),
    ahorroObjetivoPorSocio: ronda.ahorroObjetivoPorSocio.toString(),
    // 👇 si quieres usarlo en UI tipo <input type="date">
    fechaInicioDate: ronda.fechaInicio.toISOString().slice(0, 10),
    fechaFinDate: ronda.fechaFin ? ronda.fechaFin.toISOString().slice(0, 10) : null,
    // (si aún necesitas los ISO completos, puedes dejarlos también)
    fechaInicioISO: ronda.fechaInicio.toISOString(),
    fechaFinISO: ronda.fechaFin ? ronda.fechaFin.toISOString() : null,
    intervaloDiasCobro: ronda.intervaloDiasCobro,
    participaciones: ronda.participaciones.map((p) => ({
      id: p.id,
      orden: p.orden,
      socio: {
        nombres: p.socio.nombres,
        apellidos: p.socio.apellidos,
        numeroCuenta: p.socio.numeroCuenta,
      },
    })),
  });
}

// POST → crear ronda con código secuencial RDxxxx
export async function POST(req: Request) {
  const body = await req.json();
  const { nombre, montoAporte, fechaInicio, ahorroObjetivo, intervaloDiasCobro } = body as {
    nombre?: string;
    montoAporte: number;
    fechaInicio: string;             // viene como "YYYY-MM-DD"
    ahorroObjetivo: number;
    intervaloDiasCobro?: number;
  };

  // valida única ronda activa
  const activa = await prisma.ronda.findFirst({ where: { activa: true } });
  if (activa) {
    return NextResponse.json(
      { error: "Ya existe una ronda activa" },
      { status: 400 }
    );
  }

  // genera código secuencial RD0001, RD0002, ...
  const row = await prisma.$queryRaw<{ nextval: bigint }[]>`
    SELECT nextval('ronda_codigo_seq') as nextval
  `;
  const n = Number(row[0].nextval);
  const codigo = `RD${String(n).padStart(4, "0")}`;

  const intervalo = Number.isFinite(intervaloDiasCobro) && Number(intervaloDiasCobro) > 0
    ? Math.floor(Number(intervaloDiasCobro))
    : 7;

  // ⚠️ CLAVE: usar dateOnlyToUTCNoon(fechaInicio)
  const fechaInicioUTC = dateOnlyToUTCNoon(fechaInicio);

  const ronda = await prisma.ronda.create({
    data: {
      nombre: codigo,
      montoAporte: new Prisma.Decimal(Number(montoAporte ?? 0)),
      fechaInicio: fechaInicioUTC, // 👈 evita desfase por TZ
      activa: true,
      semanaActual: 1,
      ahorroObjetivoPorSocio: new Prisma.Decimal(Number(ahorroObjetivo ?? 0)),
      intervaloDiasCobro: intervalo,
    },
    select: {
      id: true,
      nombre: true,
      montoAporte: true,
      fechaInicio: true,
      fechaFin: true,
      ahorroObjetivoPorSocio: true,
      activa: true,
      semanaActual: true,
      intervaloDiasCobro: true,
    },
  });

  return NextResponse.json({
    id: ronda.id,
    nombre: ronda.nombre,
    montoAporte: ronda.montoAporte.toString(),
    fechaInicioDate: ronda.fechaInicio.toISOString().slice(0, 10),
    fechaFinDate: ronda.fechaFin ? ronda.fechaFin.toISOString().slice(0, 10) : null,
    fechaInicioISO: ronda.fechaInicio.toISOString(),
    fechaFinISO: ronda.fechaFin ? ronda.fechaFin.toISOString() : null,
    ahorroObjetivoPorSocio: ronda.ahorroObjetivoPorSocio.toString(),
    activa: ronda.activa,
    semanaActual: ronda.semanaActual,
    intervaloDiasCobro: ronda.intervaloDiasCobro,
  });
}
