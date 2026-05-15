// lib/reportes/generarExcel.ts
import ExcelJS from "exceljs";

export async function generarExcel(ronda: any): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MiRonda";
  wb.created = new Date();

  const verde = "FF1a3a2a";
  const verdeClaro = "FFe8f5e9";

  function estilizarHeader(ws: ExcelJS.Worksheet, cols: number) {
    const row = ws.getRow(1);
    for (let c = 1; c <= cols; c++) {
      const cell = row.getCell(c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: verde } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FF86efac" } },
      };
    }
    row.height = 22;
  }

  function estilizarFilas(ws: ExcelJS.Worksheet, desde: number, hasta: number) {
    for (let r = desde; r <= hasta; r++) {
      const row = ws.getRow(r);
      const esAlterna = r % 2 === 0;
      for (let c = 1; c <= ws.columnCount; c++) {
        const cell = row.getCell(c);
        if (esAlterna) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: verdeClaro } };
        }
        cell.alignment = { vertical: "middle" };
      }
      row.height = 18;
    }
  }

  // ── Hoja 1: Participantes ──────────────────────────────────────────────
  const ws1 = wb.addWorksheet("Participantes");
  ws1.columns = [
    { header: "Orden", key: "orden", width: 8 },
    { header: "Cuenta", key: "cuenta", width: 12 },
    { header: "Nombres", key: "nombres", width: 22 },
    { header: "Apellidos", key: "apellidos", width: 22 },
    { header: "Aportes ($)", key: "aportes", width: 14 },
    { header: "Ahorros ($)", key: "ahorros", width: 14 },
    { header: "Multas ($)", key: "multas", width: 12 },
  ];
  estilizarHeader(ws1, 7);

  for (const p of ronda.participaciones) {
    const aportes = ronda.aportes
      .filter((a: any) => a.socioId === p.socioId)
      .reduce((s: number, x: any) => s + Number(x.monto), 0);
    const multas = ronda.aportes
      .filter((a: any) => a.socioId === p.socioId)
      .reduce((s: number, x: any) => s + Number(x.multa ?? 0), 0);
    const ahorros = ronda.ahorros
      .filter((a: any) => a.socioId === p.socioId)
      .reduce((s: number, x: any) => s + Number(x.monto), 0);
    ws1.addRow({
      orden: p.orden,
      cuenta: p.socio.numeroCuenta,
      nombres: p.socio.nombres,
      apellidos: p.socio.apellidos,
      aportes,
      ahorros,
      multas,
    });
  }

  // Totales
  const totalRows = ws1.rowCount;
  ws1.addRow({});
  const totalRow = ws1.addRow({
    nombres: "TOTAL",
    aportes: { formula: `SUM(E2:E${totalRows})` },
    ahorros: { formula: `SUM(F2:F${totalRows})` },
    multas: { formula: `SUM(G2:G${totalRows})` },
  });
  totalRow.font = { bold: true };
  totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFd4edda" } };

  [5, 6, 7].forEach(c => { ws1.getColumn(c).numFmt = '"$"#,##0.00'; });
  estilizarFilas(ws1, 2, totalRows);

  // ── Hoja 2: Préstamos ─────────────────────────────────────────────────
  const ws2 = wb.addWorksheet("Préstamos");
  ws2.columns = [
    { header: "Socio", key: "socio", width: 28 },
    { header: "Cuenta", key: "cuenta", width: 12 },
    { header: "Monto ($)", key: "monto", width: 13 },
    { header: "Tasa (%)", key: "tasa", width: 11 },
    { header: "Plazo (meses)", key: "plazo", width: 15 },
    { header: "Estado", key: "estado", width: 12 },
    { header: "Saldo ($)", key: "saldo", width: 13 },
    { header: "Cuotas pagadas", key: "pagadas", width: 16 },
    { header: "Total cuotas", key: "total", width: 14 },
    { header: "Fecha inicio", key: "fechaInicio", width: 14 },
  ];
  estilizarHeader(ws2, 10);

  for (const p of ronda.prestamos) {
    const pagadas = p.cuotas.filter((c: any) => c.pagada).length;
    ws2.addRow({
      socio: `${p.socio.nombres} ${p.socio.apellidos}`,
      cuenta: p.socio.numeroCuenta,
      monto: Number(p.monto),
      tasa: Number(p.tasaAnual),
      plazo: p.plazoMeses,
      estado: p.estado,
      saldo: Number(p.saldoActual),
      pagadas,
      total: p.cuotas.length,
      fechaInicio: new Date(p.fechaInicio).toLocaleDateString("es-EC"),
    });
  }

  [3, 7].forEach(c => { ws2.getColumn(c).numFmt = '"$"#,##0.00'; });
  ws2.getColumn(4).numFmt = '0.00"%"';
  estilizarFilas(ws2, 2, ws2.rowCount);

  // Colorear estado
  ws2.eachRow((row, ri) => {
    if (ri === 1) return;
    const estadoCell = row.getCell(6);
    if (estadoCell.value === "ACTIVO") {
      estadoCell.font = { color: { argb: "FF15803d" }, bold: true };
    } else if (estadoCell.value === "CANCELADO") {
      estadoCell.font = { color: { argb: "FF1d4ed8" }, bold: true };
    }
  });

  // ── Hoja 3: Fondo de inversión ────────────────────────────────────────
  const ws3 = wb.addWorksheet("Fondo de Inversión");
  ws3.columns = [
    { header: "Socio", key: "socio", width: 28 },
    { header: "Cuenta", key: "cuenta", width: 12 },
    { header: "Monto invertido ($)", key: "invertido", width: 20 },
    { header: "% Participación", key: "pct", width: 17 },
    { header: "Intereses acum. ($)", key: "intereses", width: 20 },
    { header: "Total a recibir ($)", key: "total", width: 20 },
    { header: "Devuelto", key: "devuelto", width: 11 },
  ];
  estilizarHeader(ws3, 7);

  let totalFondo = 0;
  let totalIntereses = 0;

  for (const ci of ronda.cuentasInversion) {
    const invertido = Number(ci.montoInvertido);
    const intereses = Number(ci.interesesAcumulados);
    totalFondo += invertido;
    totalIntereses += intereses;
    ws3.addRow({
      socio: `${ci.socio.nombres} ${ci.socio.apellidos}`,
      cuenta: ci.socio.numeroCuenta,
      invertido,
      pct: Number(ci.porcentajeParticipacion),
      intereses,
      total: invertido + intereses,
      devuelto: ci.devuelto ? "Sí" : "No",
    });
  }

  const totalRows3 = ws3.rowCount;
  ws3.addRow({});
  const totalRow3 = ws3.addRow({
    socio: "TOTAL",
    invertido: totalFondo,
    intereses: totalIntereses,
    total: totalFondo + totalIntereses,
  });
  totalRow3.font = { bold: true };
  totalRow3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFdbeafe" } };

  [3, 5, 6].forEach(c => { ws3.getColumn(c).numFmt = '"$"#,##0.00'; });
  ws3.getColumn(4).numFmt = '0.00"%"';
  estilizarFilas(ws3, 2, totalRows3);

  const buf = await wb.xlsx.writeBuffer();
  return buf as Buffer;
}
