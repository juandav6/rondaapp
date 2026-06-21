// app/api/admin/usuarios/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarBitacora, diffObjetos, CambiosCadena } from "@/lib/bitacora";

const bcrypt = require("bcryptjs");

export const runtime = "nodejs";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const dec = (n: number) => new Prisma.Decimal(r2(n));

/* ───── GET  Listar usuarios ───── */
export async function GET() {
  try {
    const usuarios = await prisma.usuario.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        nombre: true,
        rol: true,
        socioId: true,
        createdAt: true,
        socio: {
          select: { id: true, nombres: true, apellidos: true, numeroCuenta: true },
        },
      },
    });

    return NextResponse.json({ usuarios });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

/* ───── POST  Crear usuario ───── */
export async function POST(req: Request) {
  try {
    const { email, password, nombre, rol, socioId } = await req.json();

    if (!email || !password || !rol)
      return NextResponse.json({ error: "email, password y rol son requeridos" }, { status: 400 });

    // Validar rol
    if (!["ADMIN", "SOCIO"].includes(rol))
      return NextResponse.json({ error: "Rol inválido. Debe ser ADMIN o SOCIO" }, { status: 400 });

    // Validar email único
    const existe = await prisma.usuario.findUnique({ where: { email: String(email).trim().toLowerCase() } });
    if (existe)
      return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const nuevo = await prisma.usuario.create({
      data: {
        email: String(email).trim().toLowerCase(),
        password: hashedPassword,
        nombre: nombre ? String(nombre).trim() : null,
        rol,
        ...(socioId ? { socioId: Number(socioId) } : {}),
      },
    });

    await registrarBitacora({
      tabla: "usuarios",
      registroId: nuevo.id,
      accion: "CREAR",
      camposCambios: {
        email: { antes: null, despues: nuevo.email },
        nombre: { antes: null, despues: nuevo.nombre },
        rol: { antes: null, despues: nuevo.rol },
        socioId: { antes: null, despues: nuevo.socioId },
      },
    });

    // No devolver password
    const { password: _, ...sinPassword } = nuevo;
    return NextResponse.json({ ok: true, usuario: sinPassword });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
