// lib/reportes/generarPDF.ts
// Usa pdfkit — compatible con Node.js serverless en Vercel
import PDFDocument from "pdfkit";

const VERDE = "#1a3a2a";
const VERDE_CLARO = "#e8f5e9";
const GRIS = "#6b7280";
const GRIS_CLARO = "#f9fafb";
const AZUL = "#1d4ed8";
const ROJO = "#dc2626";
const AMBER = "#d97706";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(Number(n) || 0);

const fmtDate = (iso: string | Date) => {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d);
};

export async function generarPDF(ronda: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 40, size: "A4" });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 80; // ancho útil
    const mes = new Date().toLocaleDateString("es-EC", { month: "long", year: "numeric" });
    const fechaGen = new Date().toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });

    const totalAportes = ronda.aportes.reduce((a: number, x: any) => a + Number(x.monto), 0);
    const totalAhorros = ronda.ahorros.reduce((a: number, x: any) => a + Number(x.monto), 0);
    const totalFondo = ronda.cuentasInversion.reduce((a: number, x: any) => a + Number(x.montoInvertido), 0);
    const totalIntereses = ronda.cuentasInversion.reduce((a: number, x: any) => a + Number(x.interesesAcumulados), 0);
    const prestamosActivos = ronda.prestamos.filter((p: any) => p.estado === "ACTIVO");
    const totalSaldo = prestamosActivos.reduce((a: number, p: any) => a + Number(p.saldoActual), 0);

    // ── HEADER ──────────────────────────────────────────────────────────────
    doc.rect(40, 40, W, 60).fill(VERDE);
    doc.fillColor("white").fontSize(20).font("Helvetica-Bold").text("MiRonda", 56, 52);
    doc.fontSize(10).font("Helvetica").text(`Reporte Mensual · ${ronda.nombre} · ${mes}`, 56, 76);
    doc.fillColor(GRIS).fontSize(8).text(`Generado: ${fechaGen}`, 40 + W - 100, 76, { width: 90, align: "right" });
    doc.y = 116;

    // ── KPIs ────────────────────────────────────────────────────────────────
    const kpis = [
      { label: "Total aportes", value: fmt(totalAportes), color: VERDE },
      { label: "Total ahorros", value: fmt(totalAhorros), color: VERDE },
      { label: "Fondo inversión", value: fmt(totalFondo), color: AZUL },
      { label: "Intereses acum.", value: fmt(totalIntereses), color: AMBER },
      { label: "Saldo préstamos", value: fmt(totalSaldo), color: ROJO },
      { label: "Participantes", value: String(ronda.participaciones.length), color: VERDE },
    ];
    const kpiW = W / 3;
    const kpiH = 44;
    kpis.forEach((k, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 40 + col * kpiW;
      const y = doc.y + row * (kpiH + 4);
      doc.rect(x + 2, y, kpiW - 4, kpiH).fill(GRIS_CLARO);
      doc.rect(x + 2, y, 3, kpiH).fill(k.color);
      doc.fillColor(GRIS).fontSize(7.5).font("Helvetica").text(k.label.toUpperCase(), x + 10, y + 8, { width: kpiW - 14 });
      doc.fillColor(k.color).fontSize(14).font("Helvetica-Bold").text(k.value, x + 10, y + 20, { width: kpiW - 14 });
    });
    doc.y += kpiH * 2 + 16;

    // ── INFO RONDA ───────────────────────────────────────────────────────────
    doc.rect(40, doc.y, W, 28).fill("#eff6ff");
    const infoY = doc.y + 8;
    const infoCols = [
      { label: "Semana", value: `${ronda.semanaActual} / ${ronda.participaciones.length}` },
      { label: "Inicio", value: fmtDate(ronda.fechaInicio) },
      { label: "Participantes", value: String(ronda.participaciones.length) },
      { label: "Préstamos activos", value: String(prestamosActivos.length) },
    ];
    infoCols.forEach((col, i) => {
      const x = 40 + (i * W) / 4;
      doc.fillColor(GRIS).fontSize(7).font("Helvetica").text(col.label, x + 6, infoY);
      doc.fillColor(AZUL).fontSize(9).font("Helvetica-Bold").text(col.value, x + 6, infoY + 10);
    });
    doc.y += 36;

    // Función helper para tabla
    function drawTable(headers: { label: string; width: number; align?: string }[], rows: string[][], title: string) {
      const rowH = 18;
      const headerH = 22;

      // Título sección
      doc.moveDown(0.5);
      doc.fillColor(VERDE).fontSize(11).font("Helvetica-Bold").text(title, 40, doc.y);
      doc.moveTo(40, doc.y + 2).lineTo(40 + W, doc.y + 2).strokeColor(VERDE).lineWidth(0.5).stroke();
      doc.moveDown(0.4);

      // Header tabla
      const headerY = doc.y;
      doc.rect(40, headerY, W, headerH).fill(VERDE);
      let x = 40;
      headers.forEach(h => {
        doc.fillColor("white").fontSize(8).font("Helvetica-Bold")
          .text(h.label, x + 4, headerY + 7, { width: h.width - 8, align: (h.align as any) || "left" });
        x += h.width;
      });
      doc.y = headerY + headerH;

      // Filas
      rows.forEach((row, ri) => {
        if (doc.y + rowH > doc.page.height - 60) {
          doc.addPage();
          doc.y = 40;
        }
        const rowY = doc.y;
        if (ri % 2 === 1) doc.rect(40, rowY, W, rowH).fill(GRIS_CLARO);
        let cx = 40;
        row.forEach((cell, ci) => {
          doc.fillColor("#1f2937").fontSize(8).font("Helvetica")
            .text(cell, cx + 4, rowY + 5, { width: headers[ci].width - 8, align: (headers[ci].align as any) || "left" });
          cx += headers[ci].width;
        });
        doc.y = rowY + rowH;
      });
    }

    // ── TABLA PARTICIPANTES ──────────────────────────────────────────────────
    const partHeaders = [
      { label: "#", width: 28 },
      { label: "Cuenta", width: 65 },
      { label: "Nombre completo", width: W - 28 - 65 - 80 - 80 },
      { label: "Aportes", width: 80, align: "right" },
      { label: "Ahorros", width: 80, align: "right" },
    ];
    const partRows = ronda.participaciones.map((p: any) => {
      const totalA = ronda.aportes.filter((a: any) => a.socioId === p.socioId).reduce((s: number, x: any) => s + Number(x.monto), 0);
      const totalAh = ronda.ahorros.filter((a: any) => a.socioId === p.socioId).reduce((s: number, x: any) => s + Number(x.monto), 0);
      return [String(p.orden), p.socio.numeroCuenta, `${p.socio.nombres} ${p.socio.apellidos}`, fmt(totalA), fmt(totalAh)];
    });
    drawTable(partHeaders, partRows, `Participantes (${ronda.participaciones.length})`);

    // ── TABLA PRÉSTAMOS ──────────────────────────────────────────────────────
    if (ronda.prestamos.length > 0) {
      doc.addPage();
      const prestHeaders = [
        { label: "Socio", width: W - 70 - 70 - 70 - 55 - 55 },
        { label: "Monto", width: 70, align: "right" },
        { label: "Tasa", width: 55, align: "right" },
        { label: "Saldo", width: 70, align: "right" },
        { label: "Estado", width: 55 },
        { label: "Cuotas", width: 70, align: "right" },
      ];
      const prestRows = ronda.prestamos.map((p: any) => {
        const pagadas = p.cuotas.filter((c: any) => c.pagada).length;
        return [
          `${p.socio.nombres} ${p.socio.apellidos}`,
          fmt(Number(p.monto)),
          `${Number(p.tasaAnual)}%`,
          fmt(Number(p.saldoActual)),
          p.estado,
          `${pagadas}/${p.cuotas.length}`,
        ];
      });
      drawTable(prestHeaders, prestRows, "Préstamos");
    }

    // ── TABLA INVERSIÓN ──────────────────────────────────────────────────────
    if (ronda.cuentasInversion.length > 0) {
      if (ronda.prestamos.length === 0) doc.addPage();
      const invHeaders = [
        { label: "Socio", width: W - 90 - 70 - 80 - 80 },
        { label: "Invertido", width: 90, align: "right" },
        { label: "% Part.", width: 70, align: "right" },
        { label: "Intereses", width: 80, align: "right" },
        { label: "Total", width: 80, align: "right" },
      ];
      const invRows = ronda.cuentasInversion.map((ci: any) => [
        `${ci.socio.nombres} ${ci.socio.apellidos}`,
        fmt(Number(ci.montoInvertido)),
        `${Number(ci.porcentajeParticipacion).toFixed(2)}%`,
        fmt(Number(ci.interesesAcumulados)),
        fmt(Number(ci.montoInvertido) + Number(ci.interesesAcumulados)),
      ]);
      drawTable(invHeaders, invRows, "Fondo de Inversión");
    }

    // ── FOOTER ───────────────────────────────────────────────────────────────
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(pages.start + i);
      doc.fillColor(GRIS).fontSize(7.5).font("Helvetica")
        .text(
          `MiRonda · Sistema de gestión de rondas de ahorro · Página ${i + 1} de ${pages.count}`,
          40, doc.page.height - 30, { width: W, align: "center" }
        );
    }

    doc.end();
  });
}
