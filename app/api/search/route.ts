// app/api/search/route.ts
import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ socios: [], rondas: [], prestamos: [] });
  }

  const [socios, rondas, prestamos] = await Promise.all([
    // Socios por nombre, apellido o cuenta
    prisma.socio.findMany({
      where: {
        OR: [
          { nombres: { contains: q, mode: "insensitive" } },
          { apellidos: { contains: q, mode: "insensitive" } },
          { numeroCuenta: { contains: q, mode: "insensitive" } },
          { cedula: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, nombres: true, apellidos: true, numeroCuenta: true, saldoAhorros: true },
      take: 5,
    }),

    // Rondas por nombre
    prisma.ronda.findMany({
      where: { nombre: { contains: q, mode: "insensitive" } },
      select: { id: true, nombre: true, activa: true, fechaInicio: true, fechaFin: true },
      orderBy: { fechaInicio: "desc" },
      take: 4,
    }),

    // Préstamos por nombre/cuenta del socio o nombre de ronda
    prisma.prestamo.findMany({
      where: {
        OR: [
          { socio: { nombres: { contains: q, mode: "insensitive" } } },
          { socio: { apellidos: { contains: q, mode: "insensitive" } } },
          { socio: { numeroCuenta: { contains: q, mode: "insensitive" } } },
          { ronda: { nombre: { contains: q, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true, monto: true, estado: true, saldoActual: true,
        socio: { select: { nombres: true, apellidos: true, numeroCuenta: true } },
        ronda: { select: { nombre: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  ]);

  return NextResponse.json({
    socios: socios.map(s => ({
      id: s.id,
      nombres: s.nombres,
      apellidos: s.apellidos,
      numeroCuenta: s.numeroCuenta,
      saldoAhorros: Number(s.saldoAhorros),
    })),
    rondas,
    prestamos: prestamos.map(p => ({
      id: p.id,
      monto: Number(p.monto),
      saldoActual: Number(p.saldoActual),
      estado: p.estado,
      socio: p.socio,
      ronda: p.ronda,
    })),
  });
}
