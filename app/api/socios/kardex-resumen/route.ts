// app/api/socios/kardex-resumen/route.ts
// Genera un Excel con el resumen de saldos de TODOS los socios basado en sus movimientos de cuenta
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

const fmtDate = (d: Date | string | null) => {
  if (!d) return "—";
  const dt = new Date(d as string);
  return isNaN(dt.getTime()) ? "—" : new Intl.DateTimeFormat("es-EC", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC",
  }).format(dt);
};

export async function GET() {
  try {
    // ── 1. Obtener todos los socios con su saldo almacenado ──────────────────
    const socios = await prisma.socio.findMany({
      orderBy: [{ numeroCuenta: "asc" }],
      select: {
        id: true,
        numeroCuenta: true,
        nombres: true,
        apellidos: true,
        cedula: true,
        saldoAhorros: true,
        activo: true,
      },
    });

    // ── 2. Agrupar movimientos por socio y tipo en una sola query ────────────
    const movimientos = await prisma.movimientoCuenta.groupBy({
      by: ["socioId", "tipo"],
      _sum: { monto: true },
      _count: { id: true },
    });

    // ── 3. Obtener movimientos detallados por socio (para kardex individual) ─
    const movimientosDetalle = await prisma.movimientoCuenta.findMany({
      orderBy: [{ socioId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      include: { ronda: { select: { nombre: true } } },
      select: {
        id: true,
        socioId: true,
        tipo: true,
        monto: true,
        nota: true,
        createdAt: true,
        ronda: { select: { nombre: true } },
      },
    });

    // ── 4. Build lookup map: socioId → { AHORRO, RETIRO, INVERSION, DEVOLUCION, INTERES } ──
    type TipoMap = {
      AHORRO: number; RETIRO: number; INVERSION: number; DEVOLUCION: number; INTERES: number;
      countAhorro: number; countRetiro: number; countInversion: number; countDevolucion: number; countInteres: number;
    };
    const resumenMap = new Map<number, TipoMap>();

    for (const m of movimientos) {
      if (!resumenMap.has(m.socioId)) {
        resumenMap.set(m.socioId, {
          AHORRO: 0, RETIRO: 0, INVERSION: 0, DEVOLUCION: 0, INTERES: 0,
          countAhorro: 0, countRetiro: 0, countInversion: 0, countDevolucion: 0, countInteres: 0,
        });
      }
      const entry = resumenMap.get(m.socioId)!;
      const sum = Number(m._sum.monto ?? 0);
      const cnt = m._count.id;
      if (m.tipo === "AHORRO")     { entry.AHORRO = sum;     entry.countAhorro = cnt; }
      if (m.tipo === "RETIRO")     { entry.RETIRO = sum;     entry.countRetiro = cnt; }
      if (m.tipo === "INVERSION")  { entry.INVERSION = sum;  entry.countInversion = cnt; }
      if (m.tipo === "DEVOLUCION") { entry.DEVOLUCION = sum; entry.countDevolucion = cnt; }
      if (m.tipo === "INTERES")    { entry.INTERES = sum;    entry.countInteres = cnt; }
    }

    // ── 5. Build movimientos per-socio map for detailed sheets ──────────────
    const detMap = new Map<number, typeof movimientosDetalle>();
    for (const m of movimientosDetalle) {
      if (!detMap.has(m.socioId)) detMap.set(m.socioId, []);
      detMap.get(m.socioId)!.push(m);
    }

    // ── 6. Calcular saldos ───────────────────────────────────────────────────
    type FilaSocio = {
      numeroCuenta: string; nombre: string; cedula: string; activo: boolean;
      totalAhorros: number; totalRetiros: number; totalInversiones: number;
      totalDevoluciones: number; totalIntereses: number;
      saldoCalculado: number; saldoBD: number; diferencia: number;
      movCount: number;
    };

    const filas: FilaSocio[] = socios.map(s => {
      const r = resumenMap.get(s.id) ?? {
        AHORRO: 0, RETIRO: 0, INVERSION: 0, DEVOLUCION: 0, INTERES: 0,
        countAhorro: 0, countRetiro: 0, countInversion: 0, countDevolucion: 0, countInteres: 0,
      };
      const saldoCalculado = r.AHORRO + r.DEVOLUCION + r.INTERES - r.RETIRO - r.INVERSION;
      const saldoBD = Number(s.saldoAhorros);
      return {
        numeroCuenta: s.numeroCuenta,
        nombre: `${s.nombres} ${s.apellidos}`,
        cedula: s.cedula,
        activo: s.activo,
        totalAhorros: r.AHORRO,
        totalRetiros: r.RETIRO,
        totalInversiones: r.INVERSION,
        totalDevoluciones: r.DEVOLUCION,
        totalIntereses: r.INTERES,
        saldoCalculado: Math.round(saldoCalculado * 100) / 100,
        saldoBD,
        diferencia: Math.round((saldoCalculado - saldoBD) * 100) / 100,
        movCount: r.countAhorro + r.countRetiro + r.countInversion + r.countDevolucion + r.countInteres,
      };
    });

    // ── 7. Generar Excel ─────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = "AppRonda";
    wb.created = new Date();

    // ────────────────────────────────────────────────────────────────────────
    // HOJA 1: RESUMEN GENERAL
    // ────────────────────────────────────────────────────────────────────────
    const ws = wb.addWorksheet("Resumen General");

    ws.columns = [
      { key: "n",           width: 5  },
      { key: "cuenta",      width: 13 },
      { key: "nombre",      width: 28 },
      { key: "cedula",      width: 13 },
      { key: "ahorros",     width: 14 },
      { key: "retiros",     width: 14 },
      { key: "inversiones", width: 15 },
      { key: "devoluciones",width: 15 },
      { key: "intereses",   width: 14 },
      { key: "saldoCalc",   width: 15 },
      { key: "saldoBD",     width: 15 },
      { key: "diferencia",  width: 13 },
    ];

    // Título
    ws.mergeCells("A1:L1");
    ws.getCell("A1").value = "RESUMEN GENERAL DE SALDOS POR SOCIO";
    ws.getCell("A1").font = { bold: true, size: 13, color: { argb: "FF1e3a5f" } };
    ws.getCell("A1").alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(1).height = 26;

    ws.mergeCells("A2:L2");
    ws.getCell("A2").value = `Generado: ${new Date().toLocaleDateString("es-EC", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}   ·   Total socios: ${socios.length}`;
    ws.getCell("A2").font = { size: 9, color: { argb: "FF6b7280" } };
    ws.getRow(2).height = 16;

    ws.addRow([]);

    // Encabezados de columnas (agrupados visualmente)
    // Fila de grupos
    const grpRow = ws.addRow(["", "", "", "", "← ENTRADAS →", "", "← SALIDAS →", "", "← RETORNOS →", "", "← SALDO →", ""]);
    ws.mergeCells(`E4:F4`);
    ws.mergeCells(`G4:H4`);
    ws.mergeCells(`I4:I4`);
    ws.mergeCells(`J4:K4`);
    const groupCfg: { cell: string; color: string; label: string }[] = [
      { cell: "E4", color: "FF16a34a", label: "← DEPÓSITOS / AHORROS →" },
      { cell: "G4", color: "FFdc2626", label: "← SALIDAS →"             },
      { cell: "I4", color: "FF9333ea", label: "← RETORNOS →"            },
      { cell: "J4", color: "FF0f766e", label: "← SALDO FINAL →"         },
    ];
    for (const g of groupCfg) {
      ws.getCell(g.cell).value = g.label;
      ws.getCell(g.cell).font = { bold: true, size: 8, color: { argb: "FFFFFFFF" } };
      ws.getCell(g.cell).fill = { type: "pattern", pattern: "solid", fgColor: { argb: g.color } };
      ws.getCell(g.cell).alignment = { horizontal: "center", vertical: "middle" };
    }
    ws.getRow(4).height = 16;

    // Encabezados
    const hRow = ws.addRow([
      "#", "Cuenta", "Nombre completo", "Cédula",
      "Dep./Ahorros", "Retiros",
      "Inv. al fondo", "Dev. capital",
      "Intereses",
      "Saldo calculado", "Saldo en BD",
      "Diferencia",
    ]);
    const hColors: Record<number, string> = {
      1: "FF374151", 2: "FF374151", 3: "FF374151", 4: "FF374151",
      5: "FF15803d", 6: "FFb91c1c",
      7: "FFb91c1c", 8: "FF7e22ce",
      9: "FF7e22ce",
      10: "FF0f766e", 11: "FF0f766e",
      12: "FF374151",
    };
    for (let c = 1; c <= 12; c++) {
      const cell = hRow.getCell(c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1e3a5f" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
      cell.alignment = { horizontal: c <= 4 ? "left" : "right", vertical: "middle" };
      cell.border = {
        bottom: { style: "medium", color: { argb: "FF0f766e" } },
      };
    }
    hRow.height = 20;

    const fmt$ = '"$"#,##0.00';
    const fmtDiff = '"$"#,##0.00;[Red]"-$"#,##0.00';

    let grandTotAhorros = 0, grandTotRetiros = 0, grandTotInv = 0,
        grandTotDev = 0, grandTotInt = 0, grandTotCalc = 0, grandTotBD = 0, grandTotDif = 0;
    let countDif = 0;

    filas.forEach((f, i) => {
      const row = ws.addRow([
        i + 1,
        f.numeroCuenta,
        f.nombre,
        f.cedula,
        f.totalAhorros   || null,
        f.totalRetiros   || null,
        f.totalInversiones || null,
        f.totalDevoluciones || null,
        f.totalIntereses || null,
        f.saldoCalculado,
        f.saldoBD,
        f.diferencia !== 0 ? f.diferencia : null,
      ]);

      const hasDif = Math.abs(f.diferencia) > 0.01;
      if (hasDif) countDif++;

      const bg = !f.activo ? "FFF3F4F6" : hasDif ? "FFFFF7ED" : (i % 2 === 0 ? "FFFFFFFF" : "FFF9FAFB");

      for (let c = 1; c <= 12; c++) {
        const cell = row.getCell(c);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.font = { size: 9, color: { argb: !f.activo ? "FF9CA3AF" : "FF111827" } };
        if (c >= 5) {
          cell.numFmt = c === 12 ? fmtDiff : fmt$;
          cell.alignment = { horizontal: "right" };
        }
        if (c === 10) cell.font = { ...cell.font, bold: true, color: { argb: f.saldoCalculado >= 0 ? "FF0f766e" : "FFdc2626" } };
        if (c === 12 && hasDif) cell.font = { bold: true, size: 9, color: { argb: f.diferencia > 0 ? "FF16a34a" : "FFdc2626" } };
      }

      grandTotAhorros   += f.totalAhorros;
      grandTotRetiros   += f.totalRetiros;
      grandTotInv       += f.totalInversiones;
      grandTotDev       += f.totalDevoluciones;
      grandTotInt       += f.totalIntereses;
      grandTotCalc      += f.saldoCalculado;
      grandTotBD        += f.saldoBD;
      grandTotDif       += f.diferencia;
    });

    // Fila de totales
    ws.addRow([]);
    const totRow = ws.addRow([
      "", "", "TOTALES", "",
      grandTotAhorros, grandTotRetiros,
      grandTotInv, grandTotDev,
      grandTotInt,
      grandTotCalc, grandTotBD,
      grandTotDif !== 0 ? grandTotDif : null,
    ]);
    for (let c = 1; c <= 12; c++) {
      const cell = totRow.getCell(c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1e3a5f" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
      if (c >= 5) { cell.numFmt = fmt$; cell.alignment = { horizontal: "right" }; }
      if (c === 3) { cell.alignment = { horizontal: "right" }; }
    }
    totRow.height = 20;

    // Nota al pie
    ws.addRow([]);
    if (countDif > 0) {
      const notaRow = ws.addRow([`⚠  ${countDif} socio(s) presentan diferencia entre saldo calculado y saldo en BD. Verificar en la sección de Sincronización del admin.`]);
      ws.mergeCells(`A${notaRow.number}:L${notaRow.number}`);
      notaRow.getCell(1).font = { italic: true, size: 8, color: { argb: "FFB45309" } };
      notaRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7ED" } };
    }
    const leyendaRow = ws.addRow([
      "Saldo calculado = Dep./Ahorros + Dev. capital + Intereses − Retiros − Inv. al fondo"
    ]);
    ws.mergeCells(`A${leyendaRow.number}:L${leyendaRow.number}`);
    leyendaRow.getCell(1).font = { italic: true, size: 8, color: { argb: "FF6B7280" } };

    // Auto-filter
    ws.autoFilter = { from: "A5", to: `L5` };
    ws.views = [{ state: "frozen", ySplit: 5, xSplit: 0 }];

    // ────────────────────────────────────────────────────────────────────────
    // HOJA 2: KARDEX DETALLADO (todos los socios, con separadores)
    // ────────────────────────────────────────────────────────────────────────
    const wsDet = wb.addWorksheet("Kardex Detallado");
    wsDet.columns = [
      { key: "cuenta",     width: 12 },
      { key: "socio",      width: 26 },
      { key: "fecha",      width: 13 },
      { key: "tipo",       width: 14 },
      { key: "concepto",   width: 24 },
      { key: "referencia", width: 36 },
      { key: "debe",       width: 13 },
      { key: "haber",      width: 13 },
      { key: "saldo",      width: 13 },
    ];

    // Encabezado global
    wsDet.mergeCells("A1:I1");
    wsDet.getCell("A1").value = "KARDEX DETALLADO POR SOCIO";
    wsDet.getCell("A1").font = { bold: true, size: 12, color: { argb: "FF1e3a5f" } };
    wsDet.getRow(1).height = 22;
    wsDet.mergeCells("A2:I2");
    wsDet.getCell("A2").value = `Generado: ${new Date().toLocaleDateString("es-EC")}   ·   ${socios.length} socios`;
    wsDet.getCell("A2").font = { size: 9, color: { argb: "FF6b7280" } };
    wsDet.addRow([]);

    const TIPO_CFG: Record<string, { esHaber: boolean; concepto: string; color: string }> = {
      AHORRO:     { esHaber: true,  concepto: "Depósito / Ahorro",    color: "FF16a34a" },
      RETIRO:     { esHaber: false, concepto: "Retiro",               color: "FFdc2626" },
      INVERSION:  { esHaber: false, concepto: "Aporte al fondo",      color: "FF9333ea" },
      DEVOLUCION: { esHaber: true,  concepto: "Devolución capital",   color: "FF0284c7" },
      INTERES:    { esHaber: true,  concepto: "Intereses ganados",    color: "FFd97706" },
    };

    const TIPO_ORDEN: Record<string, number> = {
      DEVOLUCION: 1, INTERES: 2, INVERSION: 3, AHORRO: 4, RETIRO: 5,
    };

    for (const socio of socios) {
      const movSocio = detMap.get(socio.id) ?? [];
      if (movSocio.length === 0) continue;

      // Ordenar movimientos
      movSocio.sort((a, b) => {
        const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (Math.abs(diff) > 86400000) return diff;
        return (TIPO_ORDEN[a.tipo] ?? 9) - (TIPO_ORDEN[b.tipo] ?? 9);
      });

      // Cabecera del socio
      const headerRow = wsDet.addRow([
        socio.numeroCuenta,
        `${socio.nombres} ${socio.apellidos}`,
        "", "CI: " + socio.cedula,
        "", "",
        "Saldo BD:", "", Number(socio.saldoAhorros),
      ]);
      wsDet.mergeCells(`B${headerRow.number}:C${headerRow.number}`);
      for (let c = 1; c <= 9; c++) {
        const cell = headerRow.getCell(c);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1e3a5f" } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
        if (c === 9) { cell.numFmt = fmt$; cell.alignment = { horizontal: "right" }; }
      }
      headerRow.height = 18;

      // Sub-encabezado columnas
      const colHRow = wsDet.addRow(["Cuenta", "Socio", "Fecha", "Tipo", "Concepto", "Referencia", "Debe (−)", "Haber (+)", "Saldo"]);
      for (let c = 1; c <= 9; c++) {
        colHRow.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFe5e7eb" } };
        colHRow.getCell(c).font = { bold: true, size: 8, color: { argb: "FF374151" } };
        if (c >= 7) colHRow.getCell(c).alignment = { horizontal: "right" };
      }
      colHRow.height = 15;

      // Filas de movimientos
      let saldoAcum = 0;
      movSocio.forEach((m, i) => {
        const cfg = TIPO_CFG[m.tipo] ?? { esHaber: true, concepto: m.tipo, color: "FF374151" };
        const monto = Number(m.monto);
        if (cfg.esHaber) saldoAcum += monto; else saldoAcum -= monto;

        const row = wsDet.addRow([
          socio.numeroCuenta,
          `${socio.nombres} ${socio.apellidos}`,
          fmtDate(m.createdAt),
          m.tipo,
          cfg.concepto,
          m.nota ?? (m.ronda?.nombre ?? "—"),
          !cfg.esHaber ? monto : null,
          cfg.esHaber ? monto : null,
          Math.round(saldoAcum * 100) / 100,
        ]);

        const bg = i % 2 === 0 ? "FFFFFFFF" : "FFF9FAFB";
        for (let c = 1; c <= 9; c++) {
          const cell = row.getCell(c);
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
          cell.font = { size: 8, color: { argb: "FF374151" } };
          if (c >= 7) { cell.numFmt = fmt$; cell.alignment = { horizontal: "right" }; }
        }
        // Colorear tipo
        row.getCell(4).font = { bold: true, size: 8, color: { argb: cfg.color } };
        // Colorear debe/haber
        if (!cfg.esHaber) row.getCell(7).font = { size: 8, color: { argb: "FFdc2626" } };
        if (cfg.esHaber)  row.getCell(8).font = { size: 8, color: { argb: "FF16a34a" } };
        // Saldo
        row.getCell(9).font = { bold: false, size: 8, color: { argb: saldoAcum >= 0 ? "FF0f766e" : "FFdc2626" } };
      });

      // Subtotal del socio
      const subTotRow = wsDet.addRow([
        "", "", "", "", "",
        "SALDO FINAL CALCULADO →",
        movSocio.filter(m => !TIPO_CFG[m.tipo]?.esHaber).reduce((s, m) => s + Number(m.monto), 0),
        movSocio.filter(m =>  TIPO_CFG[m.tipo]?.esHaber).reduce((s, m) => s + Number(m.monto), 0),
        saldoAcum,
      ]);
      for (let c = 1; c <= 9; c++) {
        const cell = subTotRow.getCell(c);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFf0fdf4" } };
        cell.font = { bold: true, size: 8, color: { argb: "FF14532d" } };
        if (c >= 7) { cell.numFmt = fmt$; cell.alignment = { horizontal: "right" }; }
      }

      // Separador
      wsDet.addRow([]);
    }

    wsDet.views = [{ state: "frozen", ySplit: 4, xSplit: 0 }];

    // ── Generar buffer y responder ───────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer();
    const fecha = new Date().toISOString().slice(0, 10);
    const nombre = `kardex-resumen-socios-${fecha}.xlsx`;

    return new Response(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nombre}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("Error kardex-resumen:", err);
    return NextResponse.json({ error: err.message ?? "Error generando reporte" }, { status: 500 });
  }
}
