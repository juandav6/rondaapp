// app/api/mobile/socio/prestamos/route.ts
// Mismo criterio que app/api/portal/[socioId]/prestamos, autenticado con
// Bearer JWT. Todos los campos Decimal de Prisma se convierten explícitamente
// con Number(): si se devuelven tal cual, JSON los serializa como texto.
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

  const prestamos = await prisma.prestamo.findMany({
    where: { socioId },
    include: {
      cuotas: { orderBy: { numero: "asc" } },
      ronda: { select: { id: true, nombre: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    prestamos: prestamos.map(p => ({
      id: p.id,
      monto: Number(p.monto),
      tasaAnual: Number(p.tasaAnual),
      plazoMeses: p.plazoMeses,
      fechaInicio: p.fechaInicio,
      estado: p.estado,
      saldoActual: Number(p.saldoActual),
      ronda: p.ronda,
      cuotas: p.cuotas.map(c => ({
        id: c.id,
        numero: c.numero,
        fechaVenc: c.fechaVenc,
        cuota: Number(c.cuota),
        pagada: c.pagada,
        fechaPago: c.fechaPago,
      })),
    })),
  });
}
