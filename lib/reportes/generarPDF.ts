// lib/reportes/generarPDF.ts
import React from "react";
import ReactPDF, {
  Document, Page, View, Text, StyleSheet,
} from "@react-pdf/renderer";

const verde = "#1a3a2a";
const verdeClaro = "#e8f5e9";
const azulClaro = "#eff6ff";
const grisClaro = "#f9fafb";

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", backgroundColor: "#ffffff" },
  // Header
  header: { marginBottom: 20, borderBottomWidth: 2, borderBottomColor: verde, paddingBottom: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  titulo: { fontSize: 22, fontFamily: "Helvetica-Bold", color: verde },
  subtitulo: { fontSize: 11, color: "#555", marginTop: 3 },
  headerRight: { alignItems: "flex-end" },
  fechaLabel: { fontSize: 9, color: "#888" },
  fechaVal: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#333" },
  // KPIs
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  kpiCard: { flex: 1, backgroundColor: verdeClaro, borderRadius: 6, padding: 10, borderLeftWidth: 3, borderLeftColor: verde },
  kpiLabel: { fontSize: 8, color: "#555", textTransform: "uppercase", marginBottom: 3 },
  kpiValue: { fontSize: 15, fontFamily: "Helvetica-Bold", color: verde },
  // Secciones
  seccion: { marginTop: 16 },
  seccionTitulo: { fontSize: 12, fontFamily: "Helvetica-Bold", color: verde, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: verde },
  // Tabla
  tabla: { width: "100%" },
  thead: { flexDirection: "row", backgroundColor: verde, paddingVertical: 5, paddingHorizontal: 4 },
  theadText: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 8, flex: 1 },
  theadTextWide: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 8, flex: 2 },
  fila: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" },
  filaAlterna: { backgroundColor: grisClaro },
  cell: { fontSize: 8, flex: 1, color: "#333" },
  cellWide: { fontSize: 8, flex: 2, color: "#333" },
  cellBold: { fontSize: 8, flex: 1, fontFamily: "Helvetica-Bold", color: "#333" },
  // Footer
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: "#d1d5db", paddingTop: 5 },
  footerText: { fontSize: 8, color: "#9ca3af" },
  // Info ronda
  infoBox: { backgroundColor: azulClaro, borderRadius: 6, padding: 10, marginBottom: 14, flexDirection: "row", gap: 16 },
  infoItem: { flex: 1 },
  infoLabel: { fontSize: 8, color: "#555", marginBottom: 2 },
  infoVal: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1e40af" },
});

const fmt = (n: number) =>
  `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function generarPDF(ronda: any): Promise<Buffer> {
  const totalAportes = ronda.aportes.reduce((a: number, x: any) => a + Number(x.monto), 0);
  const totalAhorros = ronda.ahorros.reduce((a: number, x: any) => a + Number(x.monto), 0);
  const totalFondo = ronda.cuentasInversion.reduce((a: number, x: any) => a + Number(x.montoInvertido), 0);
  const totalIntereses = ronda.cuentasInversion.reduce((a: number, x: any) => a + Number(x.interesesAcumulados), 0);
  const prestamosActivos = ronda.prestamos.filter((p: any) => p.estado === "ACTIVO");
  const totalSaldoPrestamos = prestamosActivos.reduce((a: number, p: any) => a + Number(p.saldoActual), 0);

  const mes = new Date().toLocaleDateString("es-EC", { month: "long", year: "numeric" });
  const fechaGeneracion = new Date().toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });

  const doc = React.createElement(Document, {},
    React.createElement(Page, { size: "A4", style: s.page },

      // Header
      React.createElement(View, { style: s.header },
        React.createElement(View, { style: s.headerRow },
          React.createElement(View, {},
            React.createElement(Text, { style: s.titulo }, "MiRonda"),
            React.createElement(Text, { style: s.subtitulo }, `Reporte Mensual — ${ronda.nombre} — ${mes}`)
          ),
          React.createElement(View, { style: s.headerRight },
            React.createElement(Text, { style: s.fechaLabel }, "Fecha de generación"),
            React.createElement(Text, { style: s.fechaVal }, fechaGeneracion)
          )
        )
      ),

      // Info ronda
      React.createElement(View, { style: s.infoBox },
        ...[
          { label: "Semana actual", val: `${ronda.semanaActual} / ${ronda.participaciones.length}` },
          { label: "Inicio de ronda", val: new Date(ronda.fechaInicio).toLocaleDateString("es-EC") },
          { label: "Participantes", val: String(ronda.participaciones.length) },
          { label: "Préstamos activos", val: String(prestamosActivos.length) },
        ].map(item =>
          React.createElement(View, { key: item.label, style: s.infoItem },
            React.createElement(Text, { style: s.infoLabel }, item.label),
            React.createElement(Text, { style: s.infoVal }, item.val)
          )
        )
      ),

      // KPIs
      React.createElement(View, { style: s.kpiRow },
        ...[
          { label: "Total aportes", val: fmt(totalAportes) },
          { label: "Total ahorros", val: fmt(totalAhorros) },
          { label: "Fondo inversión", val: fmt(totalFondo) },
          { label: "Intereses acum.", val: fmt(totalIntereses) },
          { label: "Saldo préstamos", val: fmt(totalSaldoPrestamos) },
        ].map(k =>
          React.createElement(View, { key: k.label, style: s.kpiCard },
            React.createElement(Text, { style: s.kpiLabel }, k.label),
            React.createElement(Text, { style: s.kpiValue }, k.val)
          )
        )
      ),

      // Tabla participantes
      React.createElement(View, { style: s.seccion },
        React.createElement(Text, { style: s.seccionTitulo }, `Participantes (${ronda.participaciones.length})`),
        React.createElement(View, { style: s.tabla },
          // Header tabla
          React.createElement(View, { style: s.thead },
            React.createElement(Text, { style: s.theadText }, "#"),
            React.createElement(Text, { style: s.theadText }, "Cuenta"),
            React.createElement(Text, { style: s.theadTextWide }, "Nombre completo"),
            React.createElement(Text, { style: s.theadText }, "Aportes"),
            React.createElement(Text, { style: s.theadText }, "Ahorros"),
          ),
          // Filas
          ...ronda.participaciones.map((p: any, i: number) => {
            const totalA = ronda.aportes.filter((a: any) => a.socioId === p.socioId).reduce((s: number, x: any) => s + Number(x.monto), 0);
            const totalAh = ronda.ahorros.filter((a: any) => a.socioId === p.socioId).reduce((s: number, x: any) => s + Number(x.monto), 0);
            return React.createElement(View, { key: p.id, style: [s.fila, i % 2 === 1 ? s.filaAlterna : {}] },
              React.createElement(Text, { style: s.cell }, String(p.orden)),
              React.createElement(Text, { style: s.cell }, p.socio.numeroCuenta),
              React.createElement(Text, { style: s.cellWide }, `${p.socio.nombres} ${p.socio.apellidos}`),
              React.createElement(Text, { style: s.cell }, fmt(totalA)),
              React.createElement(Text, { style: s.cell }, fmt(totalAh)),
            );
          })
        )
      ),

      // Footer
      React.createElement(View, { style: s.footer, fixed: true },
        React.createElement(Text, { style: s.footerText }, "MiRonda — Sistema de gestión de rondas de ahorro"),
        React.createElement(Text, { style: s.footerText, render: ({ pageNumber, totalPages }: any) => `Página ${pageNumber} de ${totalPages}` })
      )
    ),

    // Página 2 — Préstamos
    ronda.prestamos.length > 0 ? React.createElement(Page, { size: "A4", style: s.page },
      React.createElement(View, { style: s.header },
        React.createElement(Text, { style: s.titulo }, "Préstamos"),
        React.createElement(Text, { style: s.subtitulo }, `${ronda.nombre} — ${mes}`)
      ),
      React.createElement(View, { style: s.tabla },
        React.createElement(View, { style: s.thead },
          React.createElement(Text, { style: s.theadTextWide }, "Socio"),
          React.createElement(Text, { style: s.theadText }, "Monto"),
          React.createElement(Text, { style: s.theadText }, "Tasa"),
          React.createElement(Text, { style: s.theadText }, "Saldo"),
          React.createElement(Text, { style: s.theadText }, "Estado"),
          React.createElement(Text, { style: s.theadText }, "Cuotas"),
        ),
        ...ronda.prestamos.map((p: any, i: number) => {
          const pagadas = p.cuotas.filter((c: any) => c.pagada).length;
          return React.createElement(View, { key: p.id, style: [s.fila, i % 2 === 1 ? s.filaAlterna : {}] },
            React.createElement(Text, { style: s.cellWide }, `${p.socio.nombres} ${p.socio.apellidos}`),
            React.createElement(Text, { style: s.cell }, fmt(Number(p.monto))),
            React.createElement(Text, { style: s.cell }, `${Number(p.tasaAnual)}%`),
            React.createElement(Text, { style: s.cell }, fmt(Number(p.saldoActual))),
            React.createElement(Text, { style: s.cell }, p.estado),
            React.createElement(Text, { style: s.cell }, `${pagadas}/${p.cuotas.length}`),
          );
        })
      ),
      React.createElement(View, { style: s.footer, fixed: true },
        React.createElement(Text, { style: s.footerText }, "MiRonda — Sistema de gestión de rondas de ahorro"),
        React.createElement(Text, { style: s.footerText, render: ({ pageNumber, totalPages }: any) => `Página ${pageNumber} de ${totalPages}` })
      )
    ) : null,

    // Página 3 — Inversión
    ronda.cuentasInversion.length > 0 ? React.createElement(Page, { size: "A4", style: s.page },
      React.createElement(View, { style: s.header },
        React.createElement(Text, { style: s.titulo }, "Fondo de Inversión"),
        React.createElement(Text, { style: s.subtitulo }, `${ronda.nombre} — ${mes}`)
      ),
      React.createElement(View, { style: s.tabla },
        React.createElement(View, { style: s.thead },
          React.createElement(Text, { style: s.theadTextWide }, "Socio"),
          React.createElement(Text, { style: s.theadText }, "Invertido"),
          React.createElement(Text, { style: s.theadText }, "% Part."),
          React.createElement(Text, { style: s.theadText }, "Intereses"),
          React.createElement(Text, { style: s.theadText }, "Total"),
        ),
        ...ronda.cuentasInversion.map((ci: any, i: number) =>
          React.createElement(View, { key: ci.id, style: [s.fila, i % 2 === 1 ? s.filaAlterna : {}] },
            React.createElement(Text, { style: s.cellWide }, `${ci.socio.nombres} ${ci.socio.apellidos}`),
            React.createElement(Text, { style: s.cell }, fmt(Number(ci.montoInvertido))),
            React.createElement(Text, { style: s.cell }, `${Number(ci.porcentajeParticipacion).toFixed(2)}%`),
            React.createElement(Text, { style: s.cell }, fmt(Number(ci.interesesAcumulados))),
            React.createElement(Text, { style: s.cellBold }, fmt(Number(ci.montoInvertido) + Number(ci.interesesAcumulados))),
          )
        )
      ),
      React.createElement(View, { style: s.footer, fixed: true },
        React.createElement(Text, { style: s.footerText }, "MiRonda — Sistema de gestión de rondas de ahorro"),
        React.createElement(Text, { style: s.footerText, render: ({ pageNumber, totalPages }: any) => `Página ${pageNumber} de ${totalPages}` })
      )
    ) : null
  );

  const buf = await ReactPDF.renderToBuffer(doc);
  return buf;
}
