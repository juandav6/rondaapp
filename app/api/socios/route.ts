// app/api/socios/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rondaParam = url.searchParams.get("ronda");     // "actual" | null
  const rondaIdParam = url.searchParams.get("rondaId"); // "123"   | null

  // 1) Carga socios base (sin relaciones pesadas)
  const socios = await prisma.socio.findMany({
    select: {
      id: true,
      numeroCuenta: true,
      nombres: true,
      apellidos: true,
      cedula: true,
      edad: true,
    },
    orderBy: { id: "asc" },
  });

  // 2) Determina filtro por ronda si aplica
  let rondaId: number | null = null;
  if (rondaParam === "actual") {
    const activa = await prisma.ronda.findFirst({ where: { activa: true }, select: { id: true } });
    rondaId = activa?.id ?? null;
  } else if (rondaIdParam) {
    const parsed = Number(rondaIdParam);
    rondaId = Number.isFinite(parsed) ? parsed : null;
  }

  // 3) Sumas agregadas de multas (Aporte.multa) y ahorros (Ahorro.monto)
  const whereAporte = rondaId ? { rondaId } : {};
  const whereAhorro = rondaId ? { rondaId } : {};

  const multasSum = await prisma.aporte.groupBy({
    by: ["socioId"],
    where: Object.keys(whereAporte).length ? whereAporte : undefined,
    _sum: { multa: true },
  });

  const ahorrosSum = await prisma.ahorro.groupBy({
    by: ["socioId"],
    where: Object.keys(whereAhorro).length ? whereAhorro : undefined,
    _sum: { monto: true },
  });

  const mapMultas = new Map<number, number>(
    multasSum.map((m) => [m.socioId, Number(m._sum.multa ?? 0)])
  );
  const mapAhorros = new Map<number, number>(
    ahorrosSum.map((a) => [a.socioId, Number(a._sum.monto ?? 0)])
  );

  // 4) Ensambla respuesta con números (no strings)
  const result = socios.map((s) => ({
    ...s,
    ahorros: mapAhorros.get(s.id) ?? 0,
    multas: mapMultas.get(s.id) ?? 0,
  }));

  return NextResponse.json(result);
}


export async function POST(req: Request) {
  const data = await req.json();
  const socio = await prisma.socio.create({
    data,
  });
  return NextResponse.json(socio);
}
