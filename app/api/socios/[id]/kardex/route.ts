// app/api/socios/[id]/kardex/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const fmtDate = (d: Date | string | null) => {
  if (!d) return "—";
  const dt = new Date(d as string);
  return isNaN(dt.getTime()) ? "—" : new Intl.DateTimeFormat("es-EC", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC",
  }).format(dt);
};

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const socioId = Number(id);
    if (!Number.isFinite(socioId))
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const socio = await prisma.socio.findUnique({ where: { id: socioId } });
    if (!socio) return NextResponse.json({ error: "Socio no encontrado" }, { status: 404 });

    const movimientos = await prisma.movimientoCuenta.findMany({
      where: { socioId },
      include: { ronda: { select: { nombre: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    const TIPO_ORDEN: Record<string, number> = {
      DEVOLUCION: 1, INTERES: 2, INVERSION: 3, AHORRO: 4, RETIRO: 5,
    };
    movimientos.sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (Math.abs(diff) > 86400000) return diff;
      return (TIPO_ORDEN[a.tipo] ?? 9) - (TIPO_ORDEN[b.tipo] ?? 9);
    });

    const TIPO_CFG: Record<string, { esHaber: boolean; concepto: string }> = {
      AHORRO:     { esHaber: true,  concepto: "Depósito / Ahorro" },
      RETIRO:     { esHaber: false, concepto: "Retiro" },
      INVERSION:  { esHaber: false, concepto: "Aporte al fondo" },
      DEVOLUCION: { esHaber: true,  concepto: "Devolución capital" },
      INTERES:    { esHaber: true,  concepto: "Intereses ganados" },
    };

    // Agrupar AHORROs por ronda
    const ahorrosPorRonda = new Map<string, { label: string; total: number; items: { fecha: Date; ref: string; monto: number }[] }>();
    for (const m of movimientos) {
      if (m.tipo === "AHORRO") {
        let rondaNombre = m.ronda?.nombre ?? null;
        if (!rondaNombre && m.nota) {
          const match = m.nota.match(/·\s*(RD\d+)/);
          if (match) rondaNombre = match[1];
        }
        const key = m.rondaId ? `id-${m.rondaId}` : rondaNombre ? `nombre-${rondaNombre}` : "libre";
        const label = rondaNombre ?? "Depósitos libres";
        if (!ahorrosPorRonda.has(key)) ahorrosPorRonda.set(key, { label, total: 0, items: [] });
        const g = ahorrosPorRonda.get(key)!;
        g.total += Number(m.monto);
        g.items.push({ fecha: m.createdAt, ref: m.nota ?? label, monto: Number(m.monto) });
      }
    }

    // Construir líneas
    type Linea = { fecha: Date; concepto: string; referencia: string; debe: number; haber: number; saldo: number; esGrupo?: boolean; esDetalle?: boolean };
    const lineasSinSaldo: Omit<Linea, "saldo">[] = [];

    for (const [, g] of ahorrosPorRonda) {
      const fechaRef = g.items[g.items.length - 1].fecha;
      lineasSinSaldo.push({ fecha: fechaRef, concepto: `Ahorros ronda (${g.items.length} sem.)`, referencia: g.label, debe: 0, haber: g.total, esGrupo: true });
      for (const it of g.items) {
        lineasSinSaldo.push({ fecha: it.fecha, concepto: "  └ Detalle semana", referencia: it.ref, debe: 0, haber: it.monto, esDetalle: true });
      }
    }
    for (const m of movimientos) {
      if (m.tipo !== "AHORRO") {
        const cfg = TIPO_CFG[m.tipo] ?? { esHaber: true, concepto: m.tipo };
        const monto = Number(m.monto);
        lineasSinSaldo.push({ fecha: m.createdAt, concepto: cfg.concepto, referencia: m.nota ?? (m.ronda?.nombre ?? "—"), debe: cfg.esHaber ? 0 : monto, haber: cfg.esHaber ? monto : 0 });
      }
    }
    lineasSinSaldo.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    let saldo = 0;
    const lineas: Linea[] = lineasSinSaldo.map(l => {
      if (!l.esDetalle) saldo = saldo + l.haber - l.debe;
      return { ...l, saldo: l.esDetalle ? 0 : saldo };
    });

    // ── Excel ────────────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Kardex");

    ws.columns = [
      { key: "fecha",     width: 14 },
      { key: "concepto",  width: 24 },
      { key: "referencia",width: 36 },
      { key: "debe",      width: 14 },
      { key: "haber",     width: 14 },
      { key: "saldo",     width: 14 },
    ];

    // Título
    ws.mergeCells("A1:F1");
    ws.getCell("A1").value = `KARDEX: ${socio.nombres} ${socio.apellidos}  ·  ${socio.numeroCuenta}`;
    ws.getCell("A1").font = { bold: true, size: 12, color: { argb: "FF1e3a5f" } };
    ws.getCell("A1").alignment = { horizontal: "left" };
    ws.getRow(1).height = 22;

    ws.mergeCells("A2:F2");
    ws.getCell("A2").value = `Saldo actual: $${Number(socio.saldoAhorros).toFixed(2)}  ·  Generado: ${new Date().toLocaleDateString("es-EC")}`;
    ws.getCell("A2").font = { size: 9, color: { argb: "FF6b7280" } };
    ws.addRow([]);

    // Header
    const hRow = ws.addRow(["Fecha", "Concepto", "Referencia", "Debe (−)", "Haber (+)", "Saldo"]);
    for (let c = 1; c <= 6; c++) {
      hRow.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1e3a5f" } };
      hRow.getCell(c).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
      hRow.getCell(c).alignment = { horizontal: c > 3 ? "right" : "left" };
    }
    hRow.height = 20;

    const fmt$ = '"$"#,##0.00';

    lineas.forEach((l, i) => {
      const row = ws.addRow([
        fmtDate(l.fecha),
        l.concepto,
        l.referencia,
        l.debe > 0 ? l.debe : null,
        l.haber > 0 ? l.haber : null,
        l.esDetalle ? null : l.saldo,
      ]);

      const bg = l.esGrupo ? "FFf0fdf4" : l.esDetalle ? "FFf9fafb" : i % 2 === 0 ? "FFFFFFFF" : "FFF9FAFB";
      for (let c = 1; c <= 6; c++) {
        const cell = row.getCell(c);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.font = {
          size: 9,
          bold: l.esGrupo && c <= 3,
          color: { argb: l.esDetalle ? "FF9ca3af" : "FF111827" },
          italic: l.esDetalle,
        };
        if (c >= 4) { cell.numFmt = fmt$; cell.alignment = { horizontal: "right" }; }
      }
      if (l.esGrupo) {
        row.getCell(5).font = { bold: true, size: 9, color: { argb: "FF16a34a" } };
        row.getCell(6).font = { bold: true, size: 9, color: { argb: "FF0f766e" } };
      }
      if (l.debe > 0) row.getCell(4).font = { ...row.getCell(4).font, color: { argb: "FFDC2626" } };
    });

    // Total
    ws.addRow([]);
    const totRow = ws.addRow(["", "", "TOTAL",
      lineas.filter(l => !l.esDetalle).reduce((s, l) => s + l.debe, 0),
      lineas.filter(l => !l.esDetalle).reduce((s, l) => s + l.haber, 0),
      saldo,
    ]);
    for (let c = 1; c <= 6; c++) {
      totRow.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1e3a5f" } };
      totRow.getCell(c).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
      if (c >= 4) { totRow.getCell(c).numFmt = fmt$; totRow.getCell(c).alignment = { horizontal: "right" }; }
    }

    const buffer = await wb.xlsx.writeBuffer();
    const nombre = `kardex-${socio.numeroCuenta}-${new Date().toISOString().slice(0,10)}.xlsx`;
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nombre}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
