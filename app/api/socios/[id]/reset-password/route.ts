// app/api/socios/[id]/reset-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Solo admin puede resetear contraseñas
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const user = session.user as any;
  if (user.rol !== "ADMIN") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const socioId = Number(params.id);
  const { password } = await req.json();

  if (!password || typeof password !== "string" || password.trim().length < 6)
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });

  // Verificar que el socio tiene usuario
  const usuario = await prisma.usuario.findFirst({ where: { socioId } });
  if (!usuario)
    return NextResponse.json({ error: "Este socio no tiene usuario de acceso" }, { status: 404 });

  const hash = await bcrypt.hash(password.trim(), 10);
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { password: hash },
  });

  return NextResponse.json({ ok: true });
}
