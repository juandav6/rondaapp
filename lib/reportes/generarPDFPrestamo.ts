// lib/reportes/generarPDFPrestamo.ts
// Tabla de amortización con bordes reales (PDF 1.4 puro, sin deps externas)

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const fmtMoney = (n: number) =>
  `$${Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return `${String(d.getUTCDate()).padStart(2,"0")}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
};

export async function generarPDFPrestamo(prestamo: any): Promise<Buffer> {
  const fechaGen = fmtDate(new Date().toISOString());
  const cuotas: any[] = prestamo.cuotas ?? [];

  const cuotasPagadas = cuotas.filter(c => c.pagada).length;
  const totalPagado   = cuotas.filter(c =>  c.pagada).reduce((s,c)=>s+Number(c.cuota),0);
  const capitalPagado = cuotas.filter(c =>  c.pagada).reduce((s,c)=>s+Number(c.capital),0);
  const interesPagado = cuotas.filter(c =>  c.pagada).reduce((s,c)=>s+Number(c.interes),0);
  const capitalPend   = cuotas.filter(c => !c.pagada).reduce((s,c)=>s+Number(c.capital),0);
  const interesPend   = cuotas.filter(c => !c.pagada).reduce((s,c)=>s+Number(c.interes),0);
  const totalCuota    = cuotas.reduce((s,c)=>s+Number(c.cuota),0);
  const totalCapital  = cuotas.reduce((s,c)=>s+Number(c.capital),0);
  const totalInteres  = cuotas.reduce((s,c)=>s+Number(c.interes),0);

  // ── PDF engine ─────────────────────────────────────────────────────────────
  const ML    = 40;   // margin left
  const MTOP  = 790;  // first text Y
  const MIN_Y = 55;   // minimum Y before new page
  const PW    = 595;  // page width (A4 portrait)
  const PH    = 842;  // page height

  const escapePDF = (s: string) =>
    s.replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");

  const pageStreams: string[] = [];
  let S = "";   // current page stream
  let Y = MTOP; // current Y position

  const newPage = () => { pageStreams.push(S); S = ""; Y = MTOP; };
  const checkY  = (need: number) => { if (Y < MIN_Y + need) newPage(); };

  // ── Simple text-line renderer (for non-table sections) ────────────────────
  const FONT_T = 10; // title
  const FONT_N =  8; // normal
  const LH     = 12; // line height

  type Line = { text: string; bold?: boolean; sep?: boolean; blank?: boolean };

  const addLine = (ln: Line) => {
    checkY(LH);
    if (ln.blank) { Y -= LH * 0.5; return; }
    if (ln.sep) {
      S += `0.85 g\n${ML} ${Y-1} ${PW-80} 0.5 re f\n0 g\n`;
      Y -= LH * 0.55; return;
    }
    const font = ln.bold ? "F2" : "F1";
    const sz   = ln.bold ? FONT_T : FONT_N;
    S += `BT\n/${font} ${sz} Tf\n${ML} ${Y} Td\n(${escapePDF(ln.text)}) Tj\nET\n`;
    Y -= LH;
  };

  const sep   = () => addLine({ text:"", sep:true });
  const blank = () => addLine({ text:"", blank:true });
  const bold  = (t:string) => addLine({ text:t, bold:true });
  const norm  = (t:string) => addLine({ text:t });
  const pair  = (l:string, v:string, l2:string, v2:string) =>
    norm(`${l.padEnd(22)}${v.padEnd(22)}  ${l2.padEnd(22)}${v2}`);

  // ── Header ─────────────────────────────────────────────────────────────────
  bold("MIRONDA - TABLA DE AMORTIZACION DE PRESTAMO");
  sep();
  blank();
  bold(`Prestamo #${prestamo.id}`);
  blank();
  pair("Socio:", `${prestamo.socio?.nombres} ${prestamo.socio?.apellidos}`,
       "Cuenta:", prestamo.socio?.numeroCuenta ?? "-");
  pair("Ronda:", prestamo.ronda?.nombre ?? "-", "Estado:", prestamo.estado);
  blank();
  sep();
  pair("Monto original:", fmtMoney(Number(prestamo.monto)),
       "Tasa anual:", `${Number(prestamo.tasaAnual).toFixed(2)}%`);
  pair("Plazo:", `${prestamo.plazoMeses} meses`,
       "Fecha inicio:", fmtDate(prestamo.fechaInicio));
  pair("Saldo actual:", fmtMoney(Number(prestamo.saldoActual)),
       "Cuotas pagadas:", `${cuotasPagadas} de ${cuotas.length}`);
  norm(`Generado:             ${fechaGen}`);
  sep();
  blank();
  bold("TABLA DE AMORTIZACION COMPLETA");
  blank();

  // ── Table renderer (coordenadas absolutas, bordes reales) ─────────────────
  //
  // Courier: ancho de caracter = 600 unidades / 1000 = 0.6 * fontSize
  // A 7.5pt: 0.6 * 7.5 = 4.5pt por char   A 8pt: 0.6 * 8 = 4.8pt por char
  //
  // Anchos de columna elegidos para que los valores más largos quepan con padding:
  //   "21-Mar-2026" = 11 * 4.5 = 49.5pt   →  col 80pt
  //   "$1,234.56"   =  9 * 4.5 = 40.5pt   →  col 66pt
  //   "TOTALES"     =  7 * 4.8 = 33.6pt   →  (en col Vencimiento)
  // Total: 30+80+66+66+62+70+36+76 = 486pt  <  515pt disponibles ✓

  const RH   = 14;   // row height (pts)
  const PX   =  5;   // cell horizontal padding
  const PY   =  3.5; // text baseline above row bottom
  const FH   =  8;   // font size header row
  const FD   =  7.5; // font size data rows
  const CWH  =  4.8; // Courier char width @8pt
  const CWD  =  4.5; // Courier char width @7.5pt

  // [label, width(pt), align]
  const COLS: [string, number, "L"|"R"|"C"][] = [
    ["Nro",         30, "R"],
    ["Vencimiento", 80, "L"],
    ["Cuota",       66, "R"],
    ["Capital",     66, "R"],
    ["Interes",     62, "R"],
    ["Saldo",       70, "R"],
    ["Pago",        36, "C"],
    ["Fecha Pago",  76, "L"],
  ];
  const TW = COLS.reduce((s,[,w])=>s+w, 0); // total table width

  // Absolute X of each column's left edge
  const CX: number[] = [];
  { let x = ML; COLS.forEach(([,w])=>{ CX.push(x); x += w; }); }

  // X position for text inside a cell
  const txFor = (ci: number, text: string, isHeader: boolean): number => {
    const [,w,al] = COLS[ci];
    const cw = isHeader ? CWH : CWD;
    const tw = text.length * cw;
    const bx = CX[ci];
    if (al === "R") return bx + w - tw - PX;
    if (al === "C") return Math.max(bx + PX, bx + (w - tw) / 2);
    return bx + PX;
  };

  const drawRow = (cells: string[], kind: "header" | "data" | "totals") => {
    const isH = kind === "header";
    const isT = kind === "totals";

    // Page break: non-header rows only
    if (!isH && Y - RH < MIN_Y) {
      newPage();
      drawRow(COLS.map(([h]) => h), "header"); // repeat header on new page
    }

    const ry = Y; // top Y of this row

    // ── Background fill ───────────────────────────────────────────────────
    if (isH) {
      // Dark navy header
      S += `q\n0.15 0.30 0.52 rg\n${ML} ${ry-RH} ${TW} ${RH} re f\nQ\n`;
    } else if (isT) {
      // Light gray totals
      S += `q\n0.88 g\n${ML} ${ry-RH} ${TW} ${RH} re f\nQ\n`;
    }
    // Data rows: white (default, no fill needed)

    // ── Cell text ─────────────────────────────────────────────────────────
    const font   = (isH || isT) ? "F2" : "F1";
    const sz     = isH ? FH : FD;
    const tcolor = isH ? "1 g" : "0 g"; // white for header, black otherwise

    cells.forEach((text, i) => {
      if (text === "") return;
      const tx = txFor(i, text, isH).toFixed(1);
      const ty = (ry - RH + PY).toFixed(1);
      S += `q\n${tcolor}\nBT\n/${font} ${sz} Tf\n${tx} ${ty} Td\n(${escapePDF(text)}) Tj\nET\nQ\n`;
    });

    // ── Borders ───────────────────────────────────────────────────────────
    // Header uses same navy for borders; data uses light gray
    const bc = isH ? "0.15 0.30 0.52 RG" : "0.60 G";
    const bw = isH ? "1" : "0.35";

    S += `q\n${bc}\n${bw} w\n`;

    // Top horizontal line
    S += `${ML} ${ry} m ${ML+TW} ${ry} l S\n`;

    // Outer left/right verticals for this row
    S += `${ML} ${ry} m ${ML} ${ry-RH} l S\n`;
    S += `${ML+TW} ${ry} m ${ML+TW} ${ry-RH} l S\n`;

    // Inner vertical separators
    { let vx = ML;
      COLS.slice(0,-1).forEach(([,w])=>{ vx+=w; S += `${vx} ${ry} m ${vx} ${ry-RH} l S\n`; }); }

    S += `Q\n`;

    Y -= RH;
  };

  // If the estimated table height doesn't fit on remaining page, start fresh
  const estH = (cuotas.length + 2) * RH; // header + data + totals
  if (Y - estH < MIN_Y + 20) newPage();

  // Draw header row
  drawRow(COLS.map(([h]) => h), "header");

  // Draw data rows
  cuotas.forEach(c => drawRow([
    String(c.numero),
    fmtDate(c.fechaVenc),
    fmtMoney(c.cuota),
    fmtMoney(c.capital),
    fmtMoney(c.interes),
    fmtMoney(c.saldo),
    c.pagada ? "Si" : "No",
    c.fechaPago ? fmtDate(c.fechaPago) : "-",
  ], "data"));

  // Draw totals row
  drawRow(["", "TOTALES", fmtMoney(totalCuota), fmtMoney(totalCapital), fmtMoney(totalInteres), "", "", ""], "totals");

  // Final bottom border
  S += `q\n0.30 G\n0.8 w\n${ML} ${Y} m ${ML+TW} ${Y} l S\nQ\n`;
  Y -= 4;
  blank();

  // ── Summary ────────────────────────────────────────────────────────────────
  bold("RESUMEN DEL PRESTAMO");
  sep();
  const r = (l:string, v:string) => norm(`${l.padEnd(38)}${v}`);
  r("Capital total prestado:",           fmtMoney(Number(prestamo.monto)));
  r("Capital pagado:",                   `${fmtMoney(capitalPagado)}  (${cuotasPagadas} cuotas)`);
  r("Capital pendiente:",                `${fmtMoney(capitalPend)}  (${cuotas.length-cuotasPagadas} cuotas)`);
  blank();
  r("Interes total del prestamo:",       fmtMoney(totalInteres));
  r("Interes pagado:",                   fmtMoney(interesPagado));
  r("Interes pendiente:",                fmtMoney(interesPend));
  blank();
  r("Total cuotas (capital + interes):", fmtMoney(totalCuota));
  r("Total pagado:",                     fmtMoney(totalPagado));
  r("Total pendiente:",                  fmtMoney(totalCuota - totalPagado));

  if (prestamo.estado === "CANCELADO" && prestamo.notaCancelacion) {
    blank(); sep();
    bold(`CANCELADO: ${prestamo.notaCancelacion}`);
  }

  // ── Firmas ────────────────────────────────────────────────────────────────
  blank(); blank(); blank(); blank(); blank();
  sep();
  const GAP     = 14;
  const FIRMA_W = 34;
  const linea   = "_".repeat(FIRMA_W);
  const socioNombre = `${prestamo.socio?.nombres ?? ""} ${prestamo.socio?.apellidos ?? ""}`.trim();
  norm(`${linea}${" ".repeat(GAP)}${linea}`);
  blank();
  norm(`${"Responsable de la ronda".padEnd(FIRMA_W + GAP)}${socioNombre}`);
  norm(`${"".padEnd(FIRMA_W + GAP)}Elaborado por`);
  blank();
  sep();
  norm("MiRonda - Sistema de gestion de rondas de ahorro");

  // Flush last page
  if (S) pageStreams.push(S);

  // ── Ensamblar PDF 1.4 ─────────────────────────────────────────────────────
  const hdr = "%PDF-1.4\n";
  const parts: Buffer[] = [Buffer.from(hdr, "latin1")];
  const xrefs: number[] = [];

  const writeObj = (id: number, content: string) => {
    xrefs[id] = parts.reduce((s,b)=>s+b.length, 0);
    parts.push(Buffer.from(`${id} 0 obj\n${content}\nendobj\n`, "latin1"));
  };

  const CAT_ID = 1, PGS_ID = 2, F1_ID = 3, F2_ID = 4, FP_ID = 5;

  writeObj(F1_ID, `<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Courier\n/Encoding /WinAnsiEncoding\n>>`);
  writeObj(F2_ID, `<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Courier-Bold\n/Encoding /WinAnsiEncoding\n>>`);

  const pageIds: number[] = [];
  pageStreams.forEach((ps, i) => {
    const sb = Buffer.from(ps, "latin1");
    const cid = FP_ID + i*2;
    const pid = FP_ID + i*2 + 1;
    writeObj(cid, `<<\n/Length ${sb.length}\n>>\nstream\n${ps}\nendstream`);
    writeObj(pid, `<<\n/Type /Page\n/Parent ${PGS_ID} 0 R\n/MediaBox [0 0 ${PW} ${PH}]\n/Contents ${cid} 0 R\n/Resources <<\n/Font <<\n/F1 ${F1_ID} 0 R\n/F2 ${F2_ID} 0 R\n>>\n>>\n>>`);
    pageIds.push(pid);
  });

  writeObj(PGS_ID, `<<\n/Type /Pages\n/Kids [${pageIds.map(id=>`${id} 0 R`).join(" ")}]\n/Count ${pageIds.length}\n>>`);
  writeObj(CAT_ID, `<<\n/Type /Catalog\n/Pages ${PGS_ID} 0 R\n>>`);

  const xrefOff = parts.reduce((s,b)=>s+b.length, 0);
  const maxId   = Math.max(...Object.keys(xrefs).map(Number));
  let xref = `xref\n0 ${maxId+1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= maxId; i++)
    xref += `${String(xrefs[i]??0).padStart(10,"0")} 00000 n \n`;
  xref += `trailer\n<<\n/Size ${maxId+1}\n/Root ${CAT_ID} 0 R\n>>\nstartxref\n${xrefOff}\n%%EOF\n`;
  parts.push(Buffer.from(xref, "latin1"));

  return Buffer.concat(parts);
}
