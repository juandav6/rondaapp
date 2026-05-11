// app/api/socios/[id]/crear-acceso/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const user = session.user as any;
  if (user.rol !== "ADMIN") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const socioId = Number(params.id);
  const { email, password } = await req.json();

  if (!email || !password)
    return NextResponse.json({ error: "Email y contraseña requeridos" }, { status: 400 });

  if (password.trim().length < 6)
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });

  // Verificar que el socio existe
  const socio = await prisma.socio.findUnique({ where: { id: socioId } });
  if (!socio) return NextResponse.json({ error: "Socio no encontrado" }, { status: 404 });

  // Verificar que no tiene usuario ya
  const existente = await prisma.usuario.findFirst({ where: { socioId } });
  if (existente) return NextResponse.json({ error: "Este socio ya tiene acceso al portal" }, { status: 409 });

  // Verificar que el email no esté en uso
  const emailEnUso = await prisma.usuario.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (emailEnUso) return NextResponse.json({ error: "Ese correo ya está registrado" }, { status: 409 });

  const hash = await bcrypt.hash(password.trim(), 10);

  const usuario = await prisma.usuario.create({
    data: {
      email: email.toLowerCase().trim(),
      password: hash,
      nombre: `${socio.nombres} ${socio.apellidos}`,
      rol: "SOCIO",
      socioId,
    },
  });

  return NextResponse.json({ ok: true, email: usuario.email });
}
