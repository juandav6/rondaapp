// app/api/socios/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const socio = await prisma.socio.findUnique({ where: { id } });
  if (!socio) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(socio);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const body = await req.json();

    // Sanitiza; evita tocar relaciones / ids
    const data: any = {
      numeroCuenta: body.numeroCuenta?.trim(),
      cedula: body.cedula?.trim(),
      nombres: body.nombres?.trim(),
      apellidos: body.apellidos?.trim(),
      edad: body.edad != null ? Number(body.edad) : undefined,
      multas: body.multas != null ? Number(body.multas) : undefined,
    };

    const socio = await prisma.socio.update({ where: { id }, data });
    return NextResponse.json(socio);
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "La cédula o el número de cuenta ya existe." }, { status: 409 });
    }
    return NextResponse.json({ error: "Error al actualizar socio" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  await prisma.socio.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
