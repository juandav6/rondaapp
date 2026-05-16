// lib/reportes/generarPDF.ts
// pdfkit en Vercel requiere deshabilitar las fuentes del sistema
// y usar solo las fuentes embebidas del paquete

import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

const fmt = (n: number) =>
  `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso: string | Date) => {
  try {
    return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
  } catch { return "-"; }
};

export async function generarPDF(ronda: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    // Opciones que evitan buscar fuentes en el sistema de archivos
    const doc = new PDFDocument({
      margin: 40,
      size: "A4",
      font: "Courier", // fuente built-in de pdfkit, no requiere archivos externos
      bufferPages: true,
    });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 80;
    const mes = new Date().toLocaleDateString("es-EC", { month: "long", year: "numeric" });
    const fechaGen = new Date().toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });

    const totalAportes = ronda.aportes.reduce((a: number, x: any) => a + Number(x.monto), 0);
    const totalAhorros = ronda.ahorros.reduce((a: number, x: any) => a + Number(x.monto), 0);
    const totalFondo = ronda.cuentasInversion.reduce((a: number, x: any) => a + Number(x.montoInvertido), 0);
    const totalIntereses = ronda.cuentasInversion.reduce((a: number, x: any) => a + Number(x.interesesAcumulados), 0);
    const prestamosActivos = ronda.prestamos.filter((p: any) => p.estado === "ACTIVO");
    const totalSaldo = prestamosActivos.reduce((a: number, p: any) => a + Number(p.saldoActual), 0);

    // ── HEADER ────────────────────────────────────────────────────────────────
    doc.rect(40, 40, W, 55).fill("#1a3a2a");
    doc.fillColor("white").fontSize(18).font("Courier-Bold").text("MiRonda", 56, 50);
    doc.fontSize(9).font("Courier").text(`Reporte Mensual - ${ronda.nombre} - ${mes}`, 56, 72);
    doc.fillColor("#86efac").fontSize(7.5).text(`Generado: ${fechaGen}`, 56, 84);
    doc.y = 108;

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const kpis = [
      { l: "Total aportes", v: fmt(totalAportes) },
      { l: "Total ahorros", v: fmt(totalAhorros) },
      { l: "Fondo inversion", v: fmt(totalFondo) },
      { l: "Intereses acum.", v: fmt(totalIntereses) },
      { l: "Saldo prestamos", v: fmt(totalSaldo) },
      { l: "Participantes", v: String(ronda.participaciones.length) },
    ];
    const kpiW = Math.floor(W / 3);
    kpis.forEach((k, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 40 + col * kpiW;
      const y = doc.y + row * 36;
      doc.rect(x + 2, y, kpiW - 4, 32).fill("#f3f4f6");
      doc.fillColor("#6b7280").fontSize(7).font("Courier").text(k.l.toUpperCase(), x + 6, y + 5, { width: kpiW - 12 });
      doc.fillColor("#1a3a2a").fontSize(11).font("Courier-Bold").text(k.v, x + 6, y + 16, { width: kpiW - 12 });
    });
    doc.y += 36 * 2 + 12;

    // ── SEPARADOR ─────────────────────────────────────────────────────────────
    const line = () => {
      doc.moveTo(40, doc.y).lineTo(40 + W, doc.y).strokeColor("#d1d5db").lineWidth(0.5).stroke();
      doc.y += 4;
    };

    // ── FUNCIÓN TABLA ─────────────────────────────────────────────────────────
    const drawTable = (
      cols: { h: string; w: number; right?: boolean }[],
      rows: string[][],
      title: string
    ) => {
      doc.moveDown(0.6);
      if (doc.y > doc.page.height - 120) { doc.addPage(); doc.y = 40; }

      doc.fillColor("#1a3a2a").fontSize(10).font("Courier-Bold").text(title, 40, doc.y);
      doc.y += 4; line();

      // Cabecera
      const headerY = doc.y;
      doc.rect(40, headerY, W, 18).fill("#1a3a2a");
      let cx = 40;
      cols.forEach(c => {
        doc.fillColor("white").fontSize(7.5).font("Courier-Bold")
          .text(c.h, cx + 3, headerY + 5, { width: c.w - 6, align: c.right ? "right" : "left" });
        cx += c.w;
      });
      doc.y = headerY + 18;

      // Filas
      rows.forEach((row, ri) => {
        const rH = 16;
        if (doc.y + rH > doc.page.height - 50) { doc.addPage(); doc.y = 40; }
        const rowY = doc.y;
        if (ri % 2 === 1) doc.rect(40, rowY, W, rH).fill("#f9fafb");
        let rx = 40;
        row.forEach((cell, ci) => {
          doc.fillColor("#1f2937").fontSize(7.5).font("Courier")
            .text(cell, rx + 3, rowY + 4, { width: cols[ci].w - 6, align: cols[ci].right ? "right" : "left" });
          rx += cols[ci].w;
        });
        doc.y = rowY + rH;
      });
    };

    // ── PARTICIPANTES ─────────────────────────────────────────────────────────
    const nameW = W - 60 - 75 - 75;
    drawTable(
      [{ h: "#", w: 30 }, { h: "CUENTA", w: 75 }, { h: "NOMBRE", w: nameW }, { h: "APORTES", w: 75, right: true }, { h: "AHORROS", w: 75, right: true }],
      ronda.participaciones.map((p: any) => {
        const tA = ronda.aportes.filter((a: any) => a.socioId === p.socioId).reduce((s: number, x: any) => s + Number(x.monto), 0);
        const tAh = ronda.ahorros.filter((a: any) => a.socioId === p.socioId).reduce((s: number, x: any) => s + Number(x.monto), 0);
        return [String(p.orden), p.socio.numeroCuenta, `${p.socio.nombres} ${p.socio.apellidos}`, fmt(tA), fmt(tAh)];
      }),
      `Participantes (${ronda.participaciones.length})`
    );

    // ── PRÉSTAMOS ─────────────────────────────────────────────────────────────
    if (ronda.prestamos.length > 0) {
      const socioW2 = W - 70 - 55 - 70 - 55 - 65;
      drawTable(
        [{ h: "SOCIO", w: socioW2 }, { h: "MONTO", w: 70, right: true }, { h: "TASA", w: 55, right: true }, { h: "SALDO", w: 70, right: true }, { h: "ESTADO", w: 55 }, { h: "CUOTAS", w: 65, right: true }],
        ronda.prestamos.map((p: any) => {
          const pag = p.cuotas.filter((c: any) => c.pagada).length;
          return [`${p.socio.nombres} ${p.socio.apellidos}`, fmt(Number(p.monto)), `${Number(p.tasaAnual)}%`, fmt(Number(p.saldoActual)), p.estado, `${pag}/${p.cuotas.length}`];
        }),
        "Prestamos"
      );
    }

    // ── INVERSIÓN ─────────────────────────────────────────────────────────────
    if (ronda.cuentasInversion.length > 0) {
      const socioW3 = W - 80 - 65 - 80 - 80;
      drawTable(
        [{ h: "SOCIO", w: socioW3 }, { h: "INVERTIDO", w: 80, right: true }, { h: "% PART.", w: 65, right: true }, { h: "INTERESES", w: 80, right: true }, { h: "TOTAL", w: 80, right: true }],
        ronda.cuentasInversion.map((ci: any) => [
          `${ci.socio.nombres} ${ci.socio.apellidos}`,
          fmt(Number(ci.montoInvertido)),
          `${Number(ci.porcentajeParticipacion).toFixed(2)}%`,
          fmt(Number(ci.interesesAcumulados)),
          fmt(Number(ci.montoInvertido) + Number(ci.interesesAcumulados)),
        ]),
        "Fondo de Inversion"
      );
    }

    // ── FOOTER en todas las páginas ───────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.fillColor("#9ca3af").fontSize(7).font("Courier")
        .text(
          `MiRonda - Sistema de gestion de rondas de ahorro - Pagina ${i + 1} de ${range.count}`,
          40, doc.page.height - 28, { width: W, align: "center" }
        );
    }

    doc.end();
  });
}
