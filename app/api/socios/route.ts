// app/api/socios/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateRondaInicial } from "./_lib";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rondaParam = url.searchParams.get("ronda");     // "actual" | null
  const rondaIdParam = url.searchParams.get("rondaId"); // "123" | null

  // Socios base
  const socios = await prisma.socio.findMany({
    select: {
      id: true,
      numeroCuenta: true,
      nombres: true,
      apellidos: true,
      cedula: true,
      edad: true,
      multas: true, // multas "extra" de Socio
    },
    orderBy: { id: "asc" },
  });

  // Filtro opcional por ronda
  let rondaId: number | null = null;
  if (rondaParam === "actual") {
    const activa = await prisma.ronda.findFirst({ where: { activa: true }, select: { id: true } });
    rondaId = activa?.id ?? null;
  } else if (rondaIdParam && Number.isFinite(Number(rondaIdParam))) {
    rondaId = Number(rondaIdParam);
  }

  const whereAporte = rondaId ? { rondaId } : undefined;
  const whereAhorro = rondaId ? { rondaId } : undefined;

  // Agregados
  const multasSum = await prisma.aporte.groupBy({
    by: ["socioId"],
    where: whereAporte,
    _sum: { multa: true },
  });

  const ahorrosSum = await prisma.ahorro.groupBy({
    by: ["socioId"],
    where: whereAhorro,
    _sum: { monto: true },
  });

  const mapMultas = new Map(multasSum.map(m => [m.socioId, Number(m._sum.multa ?? 0)]));
  const mapAhorros = new Map(ahorrosSum.map(a => [a.socioId, Number(a._sum.monto ?? 0)]));

  // Si quieres que 'multas' en la UI refleje todo, suma: aportes.multa + socio.multas (extra)
  const result = socios.map(s => ({
    ...s,
    ahorros: mapAhorros.get(s.id) ?? 0,
    multas: (mapMultas.get(s.id) ?? 0) + Number(s.multas ?? 0),
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // === Generar número de cuenta automático ===
    const next = await prisma.$queryRaw<{ nextval: bigint }[]>`
      SELECT nextval('numero_cuenta_seq') as nextval
    `;
    const sec = Number(next[0].nextval);
    const numeroCuenta = `CTA${String(sec).padStart(4, "0")}`; // CTA0001, CTA0002, etc.

    // Sanitiza payload
    const data = {
      numeroCuenta, // 👈 ahora lo asignamos aquí
      cedula: String(body.cedula ?? "").trim(),
      nombres: String(body.nombres ?? "").trim(),
      apellidos: String(body.apellidos ?? "").trim(),
      edad: Number(body.edad ?? 0),
      multas: body.multas != null ? Number(body.multas) : undefined,
    };

    if (!data.cedula || !data.nombres || !data.apellidos || !data.edad) {
      return NextResponse.json({ error: "Faltan campos obligatorios." }, { status: 400 });
    }

    const socio = await prisma.socio.create({ data });

    // === Ahorro inicial (opcional) ===
    const ahorroInicial = Number(body.ahorroInicial ?? 0);
    if (ahorroInicial > 0) {
      const rondaId = await getOrCreateRondaInicial();

      await prisma.ahorro.upsert({
        where: {
          rondaId_socioId_semana: { rondaId, socioId: socio.id, semana: 0 },
        },
        update: { monto: ahorroInicial },
        create: { rondaId, socioId: socio.id, semana: 0, monto: ahorroInicial },
      });
    }

    return NextResponse.json(socio, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "La cédula ya existe." },
        { status: 409 }
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Error al crear socio" }, { status: 500 });
  }
}
