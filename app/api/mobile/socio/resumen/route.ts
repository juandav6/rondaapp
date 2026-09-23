// app/api/mobile/socio/resumen/route.ts
// Mismo cálculo que app/api/portal/[socioId]/resumen, pero autenticado con
// Bearer JWT para la app Flutter en vez de cookie de NextAuth.
// Un SOCIO siempre ve su propio resumen (el socioId sale del token, no de la URL).
// Un ADMIN puede pasar ?socioId=123 para ver el resumen de cualquiera.
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

  if (!socioId) {
    return NextResponse.json({ error: "Falta socioId" }, { status: 400 });
  }

  const [socio, ronda] = await Promise.all([
    prisma.socio.findUnique({
      where: { id: socioId },
      select: { id: true, nombres: true, apellidos: true, numeroCuenta: true, saldoAhorros: true },
    }),
    prisma.ronda.findFirst({
      where: { activa: true },
      include: {
        participaciones: {
          include: { socio: { select: { id: true, nombres: true, apellidos: true, numeroCuenta: true } } },
          orderBy: { orden: "asc" },
        },
      },
    }),
  ]);

  if (!socio) return NextResponse.json({ error: "Socio no encontrado" }, { status: 404 });
  if (!ronda) return NextResponse.json({ socio, ronda: null });

  const miParticipacion = ronda.participaciones.find(p => p.socioId === socioId);
  const semanaActual = ronda.semanaActual;
  const receptorEstaSemana = ronda.participaciones.find(p => p.orden === semanaActual);

  const aportesSocio = await prisma.aporte.findMany({
    where: { rondaId: ronda.id, socioId },
    select: { monto: true, multa: true, semana: true },
  });
  const totalAportado = aportesSocio.reduce((a, x) => a + Number(x.monto), 0);
  const semanasPagadas = aportesSocio.length;
  const montoAporteSemanal = Number(ronda.montoAporte);
  const semanasEsperadas = semanaActual;
  const totalEsperado = montoAporteSemanal * semanasEsperadas;
  const diferencia = totalAportado - totalEsperado;

  const ahorrosSocio = await prisma.ahorro.findMany({
    where: { rondaId: ronda.id, socioId },
    select: { monto: true, semana: true },
  });
  const totalAhorradoRonda = ahorrosSocio.reduce((a, x) => a + Number(x.monto), 0);
  const ahorroObjetivo = Number(ronda.ahorroObjetivoPorSocio ?? 0);
  const pendienteAhorro = Math.max(0, ahorroObjetivo - totalAhorradoRonda);

  const cuentaInversion = await prisma.cuentaInversion.findUnique({
    where: { rondaId_socioId: { rondaId: ronda.id, socioId } },
    select: { montoInvertido: true, porcentajeParticipacion: true, interesesAcumulados: true, devuelto: true },
  });
  const fondoTotalAgg = await prisma.cuentaInversion.aggregate({
    where: { rondaId: ronda.id },
    _sum: { montoInvertido: true },
  });

  const prestamosActivos = await prisma.prestamo.findMany({
    where: { socioId, estado: "ACTIVO" },
    select: {
      id: true, monto: true, saldoActual: true, tasaAnual: true,
      ronda: { select: { nombre: true } },
      cuotas: {
        where: { pagada: false },
        orderBy: { fechaVenc: "asc" },
        take: 1,
        select: { numero: true, fechaVenc: true, cuota: true },
      },
    },
  });
  const totalSaldoPrestamos = prestamosActivos.reduce((a, p) => a + Number(p.saldoActual), 0);
  const proximaCuota = prestamosActivos
    .flatMap(p => p.cuotas.map(c => ({ ...c, prestamo: p })))
    .sort((a, b) => new Date(a.fechaVenc).getTime() - new Date(b.fechaVenc).getTime())[0] ?? null;

  const semanaToca = miParticipacion?.orden ?? null;
  const semanasRestantes = semanaToca != null ? semanaToca - semanaActual : null;

  return NextResponse.json({
    socio,
    ronda: {
      id: ronda.id,
      nombre: ronda.nombre,
      semanaActual,
      totalParticipantes: ronda.participaciones.length,
      semanaToca,
      semanasRestantes,
      estaEnRonda: !!miParticipacion,
      fechaInicio: ronda.fechaInicio,
      montoAporteSemanal,
      receptorEstaSemana: receptorEstaSemana ? {
        nombres: receptorEstaSemana.socio.nombres,
        apellidos: receptorEstaSemana.socio.apellidos,
        numeroCuenta: receptorEstaSemana.socio.numeroCuenta,
        esMiTurno: receptorEstaSemana.socio.id === socioId,
      } : null,
      totalAportado, totalEsperado, diferencia, semanasPagadas, semanasEsperadas,
      totalAhorradoRonda, ahorroObjetivo, pendienteAhorro,
      inversion: cuentaInversion ? {
        montoInvertido: Number(cuentaInversion.montoInvertido),
        porcentajeParticipacion: Number(cuentaInversion.porcentajeParticipacion),
        interesesAcumulados: Number(cuentaInversion.interesesAcumulados),
        devuelto: cuentaInversion.devuelto,
        fondoTotal: Number(fondoTotalAgg._sum.montoInvertido ?? 0),
      } : null,
      prestamos: {
        totalSaldo: totalSaldoPrestamos,
        cantidadActivos: prestamosActivos.length,
        proximaCuota: proximaCuota ? {
          numero: proximaCuota.numero,
          monto: Number(proximaCuota.cuota),
          fechaVenc: proximaCuota.fechaVenc.toISOString(),
          rondaNombre: proximaCuota.prestamo.ronda.nombre,
        } : null,
      },
    },
  });
}
