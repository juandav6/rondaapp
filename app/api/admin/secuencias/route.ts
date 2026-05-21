// app/api/admin/secuencias/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { registrarBitacora } from "@/lib/bitacora";

export const runtime = "nodejs";

// Secuencias del sistema
const SECUENCIAS = [
  {
    key: "numero_cuenta_seq",
    nombre: "Número de cuenta (CTA)",
    prefijo: "CTA",
    padding: 4,
    descripcion: "Controla el siguiente número asignado al registrar un nuevo socio. Ej: CTA0028",
  },
  {
    key: "ronda_codigo_seq",
    nombre: "Código de ronda (RD)",
    prefijo: "RD",
    padding: 4,
    descripcion: "Controla el siguiente número asignado al crear una nueva ronda. Ej: RD0006",
  },
];

// GET → devuelve el valor actual de cada secuencia + último registro
export async function GET() {
  try {
    const resultado = await Promise.all(
      SECUENCIAS.map(async (seq) => {
        // Valor actual de la secuencia (próximo a generar)
        const rows = await prisma.$queryRawUnsafe<{ last_value: bigint; is_called: boolean }[]>(
          `SELECT last_value, is_called FROM ${seq.key}`
        );
        const lastValue = Number(rows[0]?.last_value ?? 0);
        const isCalled = rows[0]?.is_called ?? false;
        // Si is_called=false, el next será lastValue; si is_called=true, será lastValue+1
        const proximoValor = isCalled ? lastValue + 1 : lastValue;
        const proximoCodigo = `${seq.prefijo}${String(proximoValor).padStart(seq.padding, "0")}`;

        // Último registro existente en la BD
        let ultimoExistente = "";
        try {
          if (seq.key === "numero_cuenta_seq") {
            const ultimo = await prisma.socio.findFirst({
              orderBy: { id: "desc" },
              select: { numeroCuenta: true },
            });
            ultimoExistente = ultimo?.numeroCuenta ?? "—";
          } else if (seq.key === "ronda_codigo_seq") {
            const ultima = await prisma.ronda.findFirst({
              orderBy: { id: "desc" },
              select: { nombre: true },
            });
            ultimoExistente = ultima?.nombre ?? "—";
          }
        } catch { ultimoExistente = "—"; }

        return {
          ...seq,
          valorActual: lastValue,
          isCalled,
          proximoValor,
          proximoCodigo,
          ultimoExistente,
        };
      })
    );

    return NextResponse.json(resultado);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

// POST → forzar un valor específico en una secuencia
export async function POST(req: Request) {
  try {
    const { key, nuevoValor } = await req.json();

    const seq = SECUENCIAS.find(s => s.key === key);
    if (!seq) return NextResponse.json({ error: "Secuencia no encontrada" }, { status: 404 });

    const n = Number(nuevoValor);
    if (!Number.isFinite(n) || n < 1)
      return NextResponse.json({ error: "El valor debe ser un número entero mayor a 0" }, { status: 400 });

    // Leer valor anterior
    const antes = await prisma.$queryRawUnsafe<{ last_value: bigint }[]>(
      `SELECT last_value FROM ${key}`
    );
    const valorAntes = Number(antes[0]?.last_value ?? 0);

    // setval(seq, n, false) → el próximo nextval() devolverá exactamente n
    await prisma.$executeRawUnsafe(`SELECT setval('${key}', $1, false)`, n);

    // Verificar que se aplicó
    const despues = await prisma.$queryRawUnsafe<{ last_value: bigint; is_called: boolean }[]>(
      `SELECT last_value, is_called FROM ${key}`
    );
    const valorDespues = Number(despues[0]?.last_value ?? 0);
    const proximoCodigo = `${seq.prefijo}${String(n).padStart(seq.padding, "0")}`;

    await registrarBitacora({
      tabla: "secuencias",
      registroId: 0,
      accion: "EDITAR",
      camposCambios: {
        [key]: {
          antes: `${seq.prefijo}${String(valorAntes).padStart(seq.padding, "0")} (${valorAntes})`,
          despues: `${proximoCodigo} (${n})`,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      secuencia: key,
      valorAnterior: valorAntes,
      nuevoValor: valorDespues,
      proximoCodigo,
      mensaje: `Próxima ${seq.nombre}: ${proximoCodigo}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
