// app/api/mobile/socio/rondas/[id]/route.ts
// Detalle de una ronda específica para el socio: aportes y ahorros semana
// a semana (para la pantalla de detalle de ronda en la app — no existe un
// equivalente en la web, que solo muestra totales de la ronda activa).
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const rondaId = Number((await ctx.params).id);
  if (!Number.isFinite(rondaId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  let socioId: number | null = null;
  if (user.rol === "ADMIN") {
    const qp = req.nextUrl.searchParams.get("socioId");
    socioId = qp ? Number(qp) : null;
  } else {
    socioId = user.socioId;
  }
  if (!socioId) return NextResponse.json({ error: "Falta socioId" }, { status: 400 });

  const [ronda, participacion, aportes, ahorros, cuentaInversion] = await Promise.all([
    prisma.ronda.findUnique({
      where: { id: rondaId },
      include: { participaciones: { select: { id: true } } },
    }),
    prisma.participacion.findUnique({ where: { rondaId_socioId: { rondaId, socioId } } }),
    prisma.aporte.findMany({ where: { rondaId, socioId }, orderBy: { semana: "asc" } }),
    prisma.ahorro.findMany({ where: { rondaId, socioId }, orderBy: { semana: "asc" } }),
    prisma.cuentaInversion.findUnique({ where: { rondaId_socioId: { rondaId, socioId } } }),
  ]);

  if (!ronda) return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
  if (!participacion) return NextResponse.json({ error: "No participaste en esta ronda" }, { status: 403 });

  const semanasTotales = ronda.activa ? ronda.semanaActual : ronda.participaciones.length;
  const aportesPorSemana = new Map(aportes.map(a => [a.semana, a]));
  const ahorrosPorSemana = new Map(ahorros.map(a => [a.semana, a]));

  const detalleSemanas = Array.from({ length: Math.max(semanasTotales, 0) }, (_, i) => {
    const semana = i + 1;
    const aporte = aportesPorSemana.get(semana);
    const ahorro = ahorrosPorSemana.get(semana);
    return {
      semana,
      aporte: aporte
        ? { monto: Number(aporte.monto), multa: Number(aporte.multa), fecha: aporte.fecha, observaciones: aporte.observaciones, pagado: true }
        : { monto: 0, multa: 0, fecha: null, observaciones: null, pagado: false },
      ahorro: ahorro ? { monto: Number(ahorro.monto), fecha: ahorro.fecha } : { monto: 0, fecha: null },
      esMiSemana: participacion.orden === semana,
    };
  });

  const totalAportado = aportes.reduce((a, x) => a + Number(x.monto), 0);
  const totalMultas = aportes.reduce((a, x) => a + Number(x.multa), 0);
  const totalAhorrado = ahorros.reduce((a, x) => a + Number(x.monto), 0);
  const montoAporteSemanal = Number(ronda.montoAporte);

  return NextResponse.json({
    ronda: {
      id: ronda.id,
      nombre: ronda.nombre,
      activa: ronda.activa,
      fechaInicio: ronda.fechaInicio,
      fechaFin: ronda.fechaFin,
      semanaActual: ronda.semanaActual,
      totalParticipantes: ronda.participaciones.length,
      montoAporteSemanal,
      ahorroObjetivoPorSocio: Number(ronda.ahorroObjetivoPorSocio),
    },
    miOrden: participacion.orden,
    resumen: {
      totalAportado,
      totalEsperado: montoAporteSemanal * semanasTotales,
      totalMultas,
      totalAhorrado,
      semanasPagadas: aportes.length,
      semanasTotales,
    },
    inversion: cuentaInversion
      ? {
          montoInvertido: Number(cuentaInversion.montoInvertido),
          porcentajeParticipacion: Number(cuentaInversion.porcentajeParticipacion),
          interesesAcumulados: Number(cuentaInversion.interesesAcumulados),
          devuelto: cuentaInversion.devuelto,
        }
      : null,
    semanas: detalleSemanas,
  });
}
