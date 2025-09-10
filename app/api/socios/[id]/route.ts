import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const socio = await prisma.socio.findUnique({
    where: { id: Number(params.id) },
  });
  return NextResponse.json(socio);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const data = await req.json();
  const socio = await prisma.socio.update({
    where: { id: Number(params.id) },
    data,
  });
  return NextResponse.json(socio);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  await prisma.socio.delete({
    where: { id: Number(params.id) },
  });
  return NextResponse.json({ message: "Socio eliminado" });
}
