// app/api/portal/[socioId]/resumen/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { socioId: string } }) {
  const socioId = Number(params.socioId);
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const user = session.user as any;
  if (user.rol !== "ADMIN" && user.socioId !== socioId)
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const [socio, ronda] = await Promise.all([
    prisma.socio.findUnique({
      where: { id: socioId },
      select: { id: true, nombres: true, apellidos: true, numeroCuenta: true, saldoAhorros: true },
    }),
    prisma.ronda.findFirst({
      where: { activa: true },
      include: {
        participaciones: {
          include: { socio: { select: { nombres: true, apellidos: true } } },
          orderBy: { orden: "asc" },
        },
      },
    }),
  ]);

  if (!socio) return NextResponse.json({ error: "Socio no encontrado" }, { status: 404 });

  if (!ronda) {
    return NextResponse.json({ socio, ronda: null });
  }

  const miParticipacion = ronda.participaciones.find(p => p.socioId === socioId);

  // Aportes del socio en la ronda actual
  const aportesSocio = await prisma.aporte.findMany({
    where: { rondaId: ronda.id, socioId },
    select: { monto: true, multa: true, semana: true },
  });
  const totalAportado = aportesSocio.reduce((a, x) => a + Number(x.monto), 0);
  const semanasPagadas = aportesSocio.length;
  const montoAporteSemanal = Number(ronda.montoAporte);
  const semanasEsperadas = ronda.semanaActual;
  const totalEsperado = montoAporteSemanal * semanasEsperadas;
  const diferencia = totalAportado - totalEsperado; // positivo = excedente, negativo = falta

  // Ahorros del socio en la ronda actual
  const ahorrosSocio = await prisma.ahorro.findMany({
    where: { rondaId: ronda.id, socioId },
    select: { monto: true, semana: true },
  });
  const totalAhorradoRonda = ahorrosSocio.reduce((a, x) => a + Number(x.monto), 0);
  const ahorroObjetivo = Number(ronda.ahorroObjetivoPorSocio ?? 0);

  // Cuenta de inversión del socio en la ronda
  const cuentaInversion = await prisma.cuentaInversion.findUnique({
    where: { rondaId_socioId: { rondaId: ronda.id, socioId } },
    select: {
      montoInvertido: true,
      porcentajeParticipacion: true,
      interesesAcumulados: true,
      devuelto: true,
    },
  });

  // Fondo total de inversión de la ronda
  const fondoTotal = await prisma.cuentaInversion.aggregate({
    where: { rondaId: ronda.id },
    _sum: { montoInvertido: true },
  });

  const semanaToca = miParticipacion?.orden ?? null;
  const semanaActual = ronda.semanaActual;
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
      // Aportes
      totalAportado,
      totalEsperado,
      diferencia,
      semanasPagadas,
      semanasEsperadas,
      // Ahorros
      totalAhorradoRonda,
      ahorroObjetivo,
      // Inversión
      inversion: cuentaInversion ? {
        montoInvertido: Number(cuentaInversion.montoInvertido),
        porcentajeParticipacion: Number(cuentaInversion.porcentajeParticipacion),
        interesesAcumulados: Number(cuentaInversion.interesesAcumulados),
        devuelto: cuentaInversion.devuelto,
        fondoTotal: Number(fondoTotal._sum.montoInvertido ?? 0),
      } : null,
    },
  });
}
