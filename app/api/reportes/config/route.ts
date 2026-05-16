// app/api/reportes/config/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.rol !== "ADMIN")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const config = await prisma.configReporte.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, emailAdmin: "", emailsExtra: "", envioActivo: true },
  });
  return NextResponse.json(config);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.rol !== "ADMIN")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { emailAdmin, emailsExtra, envioActivo } = await req.json();

  const config = await prisma.configReporte.upsert({
    where: { id: 1 },
    update: { emailAdmin, emailsExtra, envioActivo },
    create: { id: 1, emailAdmin, emailsExtra, envioActivo },
  });
  return NextResponse.json(config);
}
