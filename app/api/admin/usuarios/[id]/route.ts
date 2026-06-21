// app/api/admin/usuarios/[id]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarBitacora, diffObjetos, CambiosCadena } from "@/lib/bitacora";

const bcrypt = require("bcryptjs");

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const dec = (n: number) => new Prisma.Decimal(r2(n));

/* ───── GET  Obtener usuario ───── */
export async function GET(_req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
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
    if (!usuario) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    return NextResponse.json({ usuario });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

/* ───── PUT  Editar usuario ───── */
export async function PUT(req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  try {
    const body = await req.json();
    const { email, nombre, rol, socioId, password } = body;

    const antes = await prisma.usuario.findUnique({ where: { id } });
    if (!antes) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    // Si se cambia el rol de ADMIN a otro, validar que no sea el último ADMIN
    if (rol && rol !== "ADMIN" && antes.rol === "ADMIN") {
      const totalAdmins = await prisma.usuario.count({ where: { rol: "ADMIN" } });
      if (totalAdmins <= 1) {
        return NextResponse.json({
          error: "No se puede cambiar el rol: es el único administrador del sistema",
        }, { status: 400 });
      }
    }

    // Validar rol si se provee
    if (rol && !["ADMIN", "SOCIO"].includes(rol))
      return NextResponse.json({ error: "Rol inválido. Debe ser ADMIN o SOCIO" }, { status: 400 });

    // Validar email único si se cambia
    if (email && email !== antes.email) {
      const existe = await prisma.usuario.findUnique({
        where: { email: String(email).trim().toLowerCase() },
      });
      if (existe)
        return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });
    }

    // Hash password si se provee
    let hashedPassword: string | undefined;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const despues = await prisma.usuario.update({
      where: { id },
      data: {
        ...(email ? { email: String(email).trim().toLowerCase() } : {}),
        ...(nombre !== undefined ? { nombre: nombre ? String(nombre).trim() : null } : {}),
        ...(rol ? { rol } : {}),
        ...(socioId !== undefined ? { socioId: socioId ? Number(socioId) : null } : {}),
        ...(hashedPassword ? { password: hashedPassword } : {}),
      },
    });

    const cambios = diffObjetos(
      {
        email: antes.email,
        nombre: antes.nombre,
        rol: antes.rol,
        socioId: antes.socioId,
        password: password ? "(cambiado)" : "(sin cambio)",
      },
      {
        email: despues.email,
        nombre: despues.nombre,
        rol: despues.rol,
        socioId: despues.socioId,
        password: password ? "(cambiado)" : "(sin cambio)",
      },
    );

    await registrarBitacora({
      tabla: "usuarios",
      registroId: id,
      accion: "EDITAR",
      camposCambios: cambios,
    });

    const { password: _, ...sinPassword } = despues;
    return NextResponse.json({ ok: true, usuario: sinPassword });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

/* ───── DELETE  Eliminar usuario ───── */
export async function DELETE(_req: Request, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  try {
    const usuario = await prisma.usuario.findUnique({ where: { id } });
    if (!usuario) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    // Validar que no sea el último ADMIN
    if (usuario.rol === "ADMIN") {
      const totalAdmins = await prisma.usuario.count({ where: { rol: "ADMIN" } });
      if (totalAdmins <= 1) {
        return NextResponse.json({
          error: "No se puede eliminar: es el único administrador del sistema",
        }, { status: 400 });
      }
    }

    await prisma.usuario.delete({ where: { id } });

    await registrarBitacora({
      tabla: "usuarios",
      registroId: id,
      accion: "ELIMINAR",
      camposCambios: {
        email: { antes: usuario.email, despues: null },
        nombre: { antes: usuario.nombre, despues: null },
        rol: { antes: usuario.rol, despues: null },
        socioId: { antes: usuario.socioId, despues: null },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
