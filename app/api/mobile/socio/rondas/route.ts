// app/api/mobile/socio/rondas/route.ts
// Historial de rondas en las que participó el socio (para la pestaña Ronda
// de la app: "listado de rondas"). No existe un equivalente exacto en la
// web — el portal solo muestra la ronda activa; esto agrega el histórico.
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  let socioId: number | null = null;
  if (user.rol === "ADMIN") {
    const qp = req.nextUrl.searchParams.get("socioId");
    socioId = qp ? Number(qp) : null;
  } else {
    socioId = user.socioId;
  }
  if (!socioId) return NextResponse.json({ error: "Falta socioId" }, { status: 400 });

  const participaciones = await prisma.participacion.findMany({
    where: { socioId },
    include: {
      ronda: {
        include: { participaciones: { select: { id: true } } },
      },
    },
    orderBy: { ronda: { fechaInicio: "desc" } },
  });

  const rondaIds = participaciones.map(p => p.ronda.id);

  const [aportesAgg, ahorrosAgg] = await Promise.all([
    prisma.aporte.groupBy({
      by: ["rondaId"],
      where: { socioId, rondaId: { in: rondaIds } },
      _sum: { monto: true },
      _count: true,
    }),
    prisma.ahorro.groupBy({
      by: ["rondaId"],
      where: { socioId, rondaId: { in: rondaIds } },
      _sum: { monto: true },
    }),
  ]);
  const aportesPorRonda = new Map(aportesAgg.map(a => [a.rondaId, { total: Number(a._sum.monto ?? 0), cantidad: a._count }]));
  const ahorrosPorRonda = new Map(ahorrosAgg.map(a => [a.rondaId, Number(a._sum.monto ?? 0)]));

  const rondas = participaciones.map(p => {
    const r = p.ronda;
    const aportes = aportesPorRonda.get(r.id) ?? { total: 0, cantidad: 0 };
    const semanasEsperadas = r.activa ? r.semanaActual : r.participaciones.length;
    return {
      id: r.id,
      nombre: r.nombre,
      activa: r.activa,
      fechaInicio: r.fechaInicio,
      fechaFin: r.fechaFin,
      semanaActual: r.semanaActual,
      totalParticipantes: r.participaciones.length,
      montoAporteSemanal: Number(r.montoAporte),
      miOrden: p.orden,
      totalAportado: aportes.total,
      totalEsperado: Number(r.montoAporte) * semanasEsperadas,
      semanasPagadas: aportes.cantidad,
      totalAhorrado: ahorrosPorRonda.get(r.id) ?? 0,
    };
  });

  return NextResponse.json({ rondas });
}
