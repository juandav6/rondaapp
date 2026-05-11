// app/api/portal/[socioId]/movimientos/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { socioId: string } }) {
  const socioId = Number(params.socioId);
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const user = session.user as any;
  if (user.rol !== "ADMIN" && user.socioId !== socioId)
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const movimientos = await prisma.movimientoCuenta.findMany({
    where: { socioId },
    include: { ronda: { select: { nombre: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ movimientos });
}