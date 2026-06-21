// app/api/admin/config/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarBitacora, diffObjetos, CambiosCadena } from "@/lib/bitacora";

export const runtime = "nodejs";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const dec = (n: number) => new Prisma.Decimal(r2(n));

/* ───── GET  Obtener ConfigReporte (upsert para garantizar existencia) ───── */
export async function GET() {
  try {
    const config = await prisma.configReporte.upsert({
      where: { id: 1 },
      create: { id: 1, emailAdmin: "", emailsExtra: "", envioActivo: true },
      update: {},
    });

    return NextResponse.json({ config });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

/* ───── PUT  Actualizar ConfigReporte ───── */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { emailAdmin, emailsExtra, envioActivo } = body;

    // Obtener estado actual (upsert para garantizar existencia)
    const antes = await prisma.configReporte.upsert({
      where: { id: 1 },
      create: { id: 1, emailAdmin: "", emailsExtra: "", envioActivo: true },
      update: {},
    });

    const despues = await prisma.configReporte.update({
      where: { id: 1 },
      data: {
        ...(emailAdmin !== undefined ? { emailAdmin: String(emailAdmin).trim() } : {}),
        ...(emailsExtra !== undefined ? { emailsExtra: String(emailsExtra).trim() } : {}),
        ...(envioActivo !== undefined ? { envioActivo: Boolean(envioActivo) } : {}),
      },
    });

    const cambios = diffObjetos(
      {
        emailAdmin: antes.emailAdmin,
        emailsExtra: antes.emailsExtra,
        envioActivo: antes.envioActivo,
      },
      {
        emailAdmin: despues.emailAdmin,
        emailsExtra: despues.emailsExtra,
        envioActivo: despues.envioActivo,
      },
    );

    await registrarBitacora({
      tabla: "config_reporte",
      registroId: 1,
      accion: "EDITAR",
      camposCambios: cambios,
    });

    return NextResponse.json({ ok: true, config: despues });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
