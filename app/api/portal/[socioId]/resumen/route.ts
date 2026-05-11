// app/api/portal/[socioId]/resumen/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function verificarAcceso(req: NextRequest, socioId: number) {
  const session = await getServerSession(authOptions);
  if (!session) return false;
  const user = session.user as any;
  // Admin puede ver cualquier socio. Socio solo se ve a sí mismo.
  if (user.rol === "ADMIN") return true;
  if (user.rol === "SOCIO" && user.socioId === socioId) return true;
  return false;
}

export async function GET(req: NextRequest, { params }: { params: { socioId: string } }) {
  const socioId = Number(params.socioId);
  if (!(await verificarAcceso(req, socioId)))
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

  // Calcular cuándo le toca cobrar
  const miParticipacion = ronda?.participaciones.find(p => p.socioId === socioId);
  const semanaToca = miParticipacion?.orden ?? null;

  return NextResponse.json({
    socio,
    ronda: ronda ? {
      id: ronda.id,
      nombre: ronda.nombre,
      semanaActual: ronda.semanaActual,
      totalParticipantes: ronda.participaciones.length,
      semanaToca,
      estaEnRonda: !!miParticipacion,
      fechaInicio: ronda.fechaInicio,
    } : null,
  });
}