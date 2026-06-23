// app/rondas/fondo/transferir/page.tsx
"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));
const fmtPct = (n: number) => `${Number(n).toFixed(4)}%`;
const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type SocioFondo = {
  socioId: number;
  socio: { nombres: string; apellidos: string; numeroCuenta: string; saldoAhorros: number };
  ahorroRonda: number;
  saldoAhorrosLibres: number;
  montoInvertidoActual: number;
  interesesAcumulados: number;
  porcentajeActual: number;
  tieneInversion: boolean;
  disponibleTransferir: number;
};

type ResultadoTransferencia = {
  fondoAnterior: number;
  fondoNuevo: number;
  montoTransferido: number;
  transferencias: {
    socioId: number;
    monto: number;
    montoAnterior: number;
    montoNuevo: number;
    pctAnterior: number;
    pctNuevo: number;
    esNuevoInversor: boolean;
  }[];
  porcentajesActualizados: { socioId: number; montoNuevo: number; pctNuevo: number }[];
};

type Toast = { text: string; type: "success" | "error" | "info" };

export default function TransferirFondoPage() {
  const [rondaId, setRondaId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fechaTransferencia, setFechaTransferencia] = useState(() => new Date().toISOString().slice(0, 10));

  const [ronda, setRonda] = useState<{ id: number; nombre: string; activa: boolean } | null>(null);
  const [fondoActual, setFondoActual] = useState(0);
  const [socios, setSocios] = useState<SocioFondo[]>([]);
  const [totalAhorrosRonda, setTotalAhorrosRonda] = useState(0);
  const [totalYaTransferido, setTotalYaTransferido] = useState(0);
  const [totalDisponible, setTotalDisponible] = useState(0);
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [resultado, setResultado] = useState<ResultadoTransferencia | null>(null);
  const [tab, setTab] = useState<"transferir" | "resultado" | "historial">("transferir");
  const [historial, setHistorial] = useState<any[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const showToast = (text: string, type: Toast["type"] = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  async function cargar() {
    setLoading(true); setError(null);
    try {
      // 1. Obtener ronda activa
      const rRes = await fetch("/api/rondas", { cache: "no-store" });
      if (rRes.status === 204 || !rRes.ok)
        throw new Error("No hay una ronda activa. Crea una ronda primero.");
      const rData = await rRes.json();
      const id = Number(rData.id);
      if (!id) throw new Error("No se pudo obtener el ID de la ronda activa.");
      setRondaId(id);

      // 2. Cargar datos del fondo
      const res = await fetch(`/api/rondas/${id}/inversion/transferir`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRonda(data.ronda);
      setFondoActual(data.fondoActual);
      setSocios(data.socios);
      setTotalAhorrosRonda(data.totalAhorrosRonda);
      setTotalYaTransferido(data.totalYaTransferido ?? 0);
      setTotalDisponible(data.totalDisponible ?? data.totalAhorrosRonda);
      const init: Record<number, string> = {};
      data.socios.forEach((s: SocioFondo) => { init[s.socioId] = ""; });
      setInputs(init);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { cargar(); }, []);

  async function cargarHistorial() {
    if (!rondaId) return;
    setLoadingHistorial(true);
    try {
      const res = await fetch(`/api/admin/movimientos-cuenta?tipo=TODOS&limit=500`);
      const d = await res.json();
      const movs = (d.movimientos ?? []).filter((m: any) =>
        ["INVERSION", "DEVOLUCION", "INTERES"].includes(m.tipo) && m.ronda?.id === rondaId
      );
      setHistorial(movs);
    } catch {} finally { setLoadingHistorial(false); }
  }

  // Total a transferir según inputs
  const totalTransferir = useMemo(() =>
    Object.values(inputs).reduce((s, v) => s + (Number(v) || 0), 0), [inputs]);

  // Preview de porcentajes nuevos
  const previewPct = useMemo(() => {
    const fondoNuevo = fondoActual + totalTransferir;
    if (fondoNuevo <= 0) return [];

    // Construir mapa: socioId → montoNuevo
    const montos: { socioId: number; montoNuevo: number; nombre: string }[] = [];

    // Los que ya tienen inversión
    socios.forEach(s => {
      const adicional = Number(inputs[s.socioId] || 0);
      if (s.tieneInversion || adicional > 0) {
        montos.push({
          socioId: s.socioId,
          montoNuevo: s.montoInvertidoActual + adicional,
          nombre: `${s.socio.nombres} ${s.socio.apellidos}`,
        });
      }
    });

    const pcts = montos.map(m => ({
      ...m,
      pct: Math.round((m.montoNuevo / fondoNuevo) * 10000) / 100,
    }));

    // Ajuste de centésimas
    const sumPct = pcts.reduce((s, p) => s + p.pct, 0);
    const diff = Math.round((100 - sumPct) * 100) / 100;
    if (pcts.length > 0) pcts[pcts.length - 1].pct = Math.round((pcts[pcts.length - 1].pct + diff) * 100) / 100;

    return pcts.sort((a, b) => b.pct - a.pct);
  }, [fondoActual, totalTransferir, socios, inputs]);

  function setTodos() {
    const next: Record<number, string> = {};
    socios.forEach(s => {
      next[s.socioId] = s.disponibleTransferir > 0 ? s.disponibleTransferir.toFixed(2) : "";
    });
    setInputs(next);
  }

  function limpiar() {
    const next: Record<number, string> = {};
    socios.forEach(s => { next[s.socioId] = ""; });
    setInputs(next);
  }

  async function ejecutarTransferencia() {
    if (!rondaId) { showToast("No hay ronda activa", "error"); return; }
    setConfirmOpen(false);
    setSaving(true);
    try {
      const transferencias = Object.entries(inputs)
        .map(([socioId, monto]) => ({ socioId: Number(socioId), monto: Number(monto) || 0 }))
        .filter(t => t.monto > 0);

      if (!transferencias.length) throw new Error("No hay montos para transferir");

      const res = await fetch(`/api/rondas/${rondaId}/inversion/transferir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferencias, fecha: fechaTransferencia }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setResultado(data);
      setTab("resultado");
      showToast(`¡Transferencia exitosa! ${fmt(data.montoTransferido)} agregados al fondo.`);
      await cargar();
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setSaving(false); }
  }

  if (loading) return (
    <div className="p-4 space-y-3">
      {[...Array(5)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />)}
    </div>
  );

  if (error) return (
    <div className="p-4">
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">{error}</div>
    </div>
  );

  return (
    <div className="space-y-4 p-3 sm:p-6">
      {/* Toast */}
      {toast && (
        <div className={cn("fixed bottom-4 right-4 z-50 rounded-xl px-4 py-3 text-sm shadow-lg ring-1 max-w-sm",
          toast.type === "success" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" :
          toast.type === "error" ? "bg-red-50 text-red-800 ring-red-200" : "bg-blue-50 text-blue-800 ring-blue-200")}>
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M12 7.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"/>
                <path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 14.625v-9.75Z" clipRule="evenodd"/>
              </svg>
            </span>
            <div>
              <h1 className="text-base sm:text-xl font-bold text-gray-900">Transferir ahorros al fondo</h1>
              <p className="text-xs text-gray-500 mt-0.5">{ronda?.nombre} · Fondo actual: <strong className="text-blue-700">{fmt(fondoActual)}</strong></p>
            </div>
          </div>
          <Link href="/rondas/historial" className="text-xs border rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50 shrink-0">← Historial</Link>
        </div>

        {/* KPIs */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
            <p className="text-[10px] text-blue-600 font-medium uppercase">Fondo actual</p>
            <p className="text-lg font-bold text-blue-800 tabular-nums">{fmt(fondoActual)}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
            <p className="text-[10px] text-emerald-600 font-medium uppercase">Ahorros en ronda</p>
            <p className="text-lg font-bold text-emerald-800 tabular-nums">{fmt(totalAhorrosRonda)}</p>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
            <p className="text-[10px] text-amber-600 font-medium uppercase">Ya transferido</p>
            <p className="text-lg font-bold text-amber-800 tabular-nums">{fmt(totalYaTransferido)}</p>
          </div>
          <div className={cn("rounded-xl border p-3", totalDisponible > 0 ? "bg-violet-50 border-violet-100" : "bg-gray-50 border-gray-200")}>
            <p className={cn("text-[10px] font-medium uppercase", totalDisponible > 0 ? "text-violet-600" : "text-gray-400")}>Disponible transferir</p>
            <p className={cn("text-lg font-bold tabular-nums", totalDisponible > 0 ? "text-violet-800" : "text-gray-400")}>{fmt(totalDisponible)}</p>
            {totalTransferir > 0 && <p className="text-[10px] text-violet-500">Seleccionado: {fmt(totalTransferir)}</p>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border bg-gray-50 p-1">
        {(["transferir", "resultado", "historial"] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); if (t === "historial" && historial.length === 0) cargarHistorial(); }}
            className={cn("flex-1 rounded-lg py-2 text-xs sm:text-sm font-medium transition-colors",
              tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700")}>
            {t === "transferir" ? "Transferir" : t === "resultado" ? (resultado ? "Resultado ✓" : "Resultado") : "Historial"}
          </button>
        ))}
      </div>

      {/* Tab transferir */}
      {tab === "transferir" && (
        <div className="space-y-3">
          {/* Acciones rápidas */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={setTodos} disabled={totalDisponible <= 0}
              className="rounded-lg border bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
              Transferir todos los ahorros
            </button>
            <button onClick={limpiar} className="rounded-lg border bg-white px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 shadow-sm">
              Limpiar
            </button>
          </div>

          {totalDisponible <= 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="font-semibold">Todos los ahorros ya fueron transferidos al fondo</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Se transfirieron {fmt(totalYaTransferido)} en transferencias anteriores. 
                  Cuando los socios registren nuevos ahorros podrás transferirlos.
                </p>
              </div>
            </div>
          )}

          {/* Tabla desktop */}
          <div className="hidden md:block rounded-xl border bg-white shadow-sm overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Socio</th>
                  <th className="px-4 py-3 text-right">Ahorro ronda</th>
                  <th className="px-4 py-3 text-right">Ya transferido</th>
                  <th className="px-4 py-3 text-right">Invertido actual</th>
                  <th className="px-4 py-3 text-right">% actual</th>
                  <th className="px-4 py-3 text-right">Transferir ($)</th>
                  <th className="px-4 py-3 text-right">% nuevo</th>
                </tr>
              </thead>
              <tbody>
                {socios.map(s => {
                  const input = Number(inputs[s.socioId] || 0);
                  const pctNuevo = previewPct.find(p => p.socioId === s.socioId)?.pct ?? s.porcentajeActual;
                  const pctCambio = pctNuevo - s.porcentajeActual;
                  const excede = input > s.disponibleTransferir + 0.01;
                  return (
                    <tr key={s.socioId} className={cn("border-t", excede && "bg-red-50/50")}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{s.socio.nombres} {s.socio.apellidos}</p>
                        <p className="text-xs text-gray-400 font-mono">{s.socio.numeroCuenta}</p>
                        {s.tieneInversion && <span className="inline-flex rounded-full bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[10px] font-medium mt-0.5">Inversor</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-emerald-700">{fmt(s.ahorroRonda)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-600">
                        {(s as any).yaTransferido > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            {fmt((s as any).yaTransferido)}
                            <span className="text-[10px] text-amber-400">✓</span>
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-blue-700">{s.tieneInversion ? fmt(s.montoInvertidoActual) : <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs text-gray-500">{s.tieneInversion ? fmtPct(s.porcentajeActual) : <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="number" min="0" step="0.01"
                            max={s.disponibleTransferir}
                            placeholder="0.00"
                            value={inputs[s.socioId] ?? ""}
                            onChange={e => setInputs(p => ({ ...p, [s.socioId]: e.target.value }))}
                            className={cn("w-28 rounded-lg border px-2 py-1.5 text-right text-xs focus:outline-none focus:ring-1",
                              excede ? "border-red-300 focus:ring-red-200" : "focus:ring-blue-200 focus:border-blue-400")}
                          />
                          <button
                            onClick={() => setInputs(p => ({ ...p, [s.socioId]: s.disponibleTransferir.toFixed(2) }))}
                            className="text-[10px] text-blue-600 hover:text-blue-800 whitespace-nowrap"
                            title="Usar todo">
                            máx
                          </button>
                        </div>
                        {excede && <p className="text-[10px] text-red-500 text-right mt-0.5">Máx: {fmt(s.disponibleTransferir)}</p>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(s.tieneInversion || input > 0) ? (
                          <div>
                            <p className="text-sm font-bold tabular-nums text-blue-700">{fmtPct(pctNuevo)}</p>
                            {pctCambio !== 0 && input > 0 && (
                              <p className={cn("text-[10px]", pctCambio > 0 ? "text-emerald-600" : "text-red-500")}>
                                {pctCambio > 0 ? "+" : ""}{pctCambio.toFixed(4)}%
                              </p>
                            )}
                          </div>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t bg-gray-50">
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700 tabular-nums">{fmt(totalAhorrosRonda)}</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700 tabular-nums">{fmt(fondoActual)}</td>
                  <td className="px-4 py-3 text-right text-xs font-medium">100%</td>
                  <td className="px-4 py-3 text-right font-bold text-violet-700 tabular-nums">{fmt(totalTransferir)}</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700 tabular-nums">{totalTransferir > 0 ? fmt(fondoActual + totalTransferir) : "—"}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Tarjetas móvil */}
          <div className="md:hidden space-y-2">
            {socios.map(s => {
              const input = Number(inputs[s.socioId] || 0);
              const pctNuevo = previewPct.find(p => p.socioId === s.socioId)?.pct ?? s.porcentajeActual;
              const excede = input > s.disponibleTransferir + 0.01;
              return (
                <div key={s.socioId} className={cn("rounded-xl border bg-white p-3 space-y-2 shadow-sm", excede && "border-red-300")}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{s.socio.nombres} {s.socio.apellidos}</p>
                      <p className="text-xs text-gray-400 font-mono">{s.socio.numeroCuenta}</p>
                    </div>
                    {s.tieneInversion && <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-medium shrink-0">Inversor</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-xs">
                    <div className="rounded bg-emerald-50 p-2">
                      <p className="text-emerald-500">Ahorro</p>
                      <p className="font-bold text-emerald-700 tabular-nums">{fmt(s.ahorroRonda)}</p>
                    </div>
                    <div className="rounded bg-blue-50 p-2">
                      <p className="text-blue-500">Invertido</p>
                      <p className="font-bold text-blue-700 tabular-nums">{s.tieneInversion ? fmt(s.montoInvertidoActual) : "—"}</p>
                    </div>
                    <div className="rounded bg-violet-50 p-2">
                      <p className="text-violet-500">% nuevo</p>
                      <p className="font-bold text-violet-700">{(s.tieneInversion || input > 0) ? fmtPct(pctNuevo) : "—"}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number" min="0" step="0.01" max={s.disponibleTransferir}
                      placeholder={`Máx: ${fmt(s.disponibleTransferir)}`}
                      value={inputs[s.socioId] ?? ""}
                      onChange={e => setInputs(p => ({ ...p, [s.socioId]: e.target.value }))}
                      className={cn("flex-1 rounded-lg border px-3 py-2 text-sm text-right focus:outline-none focus:ring-1",
                        excede ? "border-red-300" : "focus:ring-blue-200")}
                    />
                    <button
                      onClick={() => setInputs(p => ({ ...p, [s.socioId]: s.disponibleTransferir.toFixed(2) }))}
                      className="rounded-lg border px-3 py-2 text-xs text-blue-600 hover:bg-blue-50">
                      Máx
                    </button>
                  </div>
                  {excede && <p className="text-xs text-red-500">Excede el máximo disponible: {fmt(s.disponibleTransferir)}</p>}
                </div>
              );
            })}
          </div>

          {/* Botón transferir */}
          {totalTransferir > 0 && (
            <div className="sticky bottom-4 flex justify-end">
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={saving}
                className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 shadow-lg disabled:opacity-50">
                Transferir {fmt(totalTransferir)} al fondo →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab resultado */}
      {tab === "resultado" && resultado && (
        <div className="space-y-4">
          {/* Resumen transferencia */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-lg">✓</span>
              <div>
                <h2 className="text-base font-bold text-emerald-900">Transferencia exitosa</h2>
                <p className="text-xs text-emerald-600">{fmt(resultado.montoTransferido)} transferidos al fondo</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-white p-3 text-center">
                <p className="text-xs text-gray-500">Fondo anterior</p>
                <p className="text-lg font-bold text-gray-700 tabular-nums">{fmt(resultado.fondoAnterior)}</p>
              </div>
              <div className="rounded-lg bg-blue-600 p-3 text-center">
                <p className="text-xs text-blue-100">Fondo nuevo</p>
                <p className="text-lg font-bold text-white tabular-nums">{fmt(resultado.fondoNuevo)}</p>
              </div>
              <div className="rounded-lg bg-white p-3 text-center">
                <p className="text-xs text-gray-500">Agregado</p>
                <p className="text-lg font-bold text-emerald-600 tabular-nums">+{fmt(resultado.montoTransferido)}</p>
              </div>
            </div>
          </div>

          {/* Detalle por socio */}
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b bg-gray-50 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-800">Detalle por socio — porcentajes actualizados</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Socio</th>
                    <th className="px-4 py-3 text-right">Transferido</th>
                    <th className="px-4 py-3 text-right">Monto anterior</th>
                    <th className="px-4 py-3 text-right">Monto nuevo</th>
                    <th className="px-4 py-3 text-right">% anterior</th>
                    <th className="px-4 py-3 text-right">% nuevo</th>
                    <th className="px-4 py-3 text-right">Cambio</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.transferencias.map(t => {
                    const socio = socios.find(s => s.socioId === t.socioId);
                    const cambio = t.pctNuevo - t.pctAnterior;
                    return (
                      <tr key={t.socioId} className="border-t">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{socio?.socio.nombres} {socio?.socio.apellidos}</p>
                          {t.esNuevoInversor && <span className="inline-flex rounded-full bg-violet-100 text-violet-700 px-1.5 py-0.5 text-[10px] font-medium">Nuevo inversor</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-violet-700">+{fmt(t.monto)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-500">{fmt(t.montoAnterior)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-blue-700">{fmt(t.montoNuevo)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-xs text-gray-500">{fmtPct(t.pctAnterior)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-bold text-blue-700">{fmtPct(t.pctNuevo)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn("text-xs font-semibold", cambio > 0 ? "text-emerald-600" : cambio < 0 ? "text-red-500" : "text-gray-400")}>
                            {cambio > 0 ? "+" : ""}{cambio.toFixed(4)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabla completa de % actualizados (todos los inversores) */}
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b bg-gray-50 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-800">Porcentajes finales del fondo — todos los inversores</h3>
              <p className="text-xs text-gray-400 mt-0.5">Fondo total: <strong>{fmt(resultado.fondoNuevo)}</strong></p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Socio</th>
                    <th className="px-4 py-3 text-right">Monto invertido</th>
                    <th className="px-4 py-3 text-right">% participación</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.porcentajesActualizados.sort((a, b) => b.pctNuevo - a.pctNuevo).map(p => {
                    const socio = socios.find(s => s.socioId === p.socioId);
                    return (
                      <tr key={p.socioId} className="border-t hover:bg-gray-50/70">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{socio?.socio.nombres} {socio?.socio.apellidos}</p>
                          <p className="text-xs text-gray-400 font-mono">{socio?.socio.numeroCuenta}</p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-blue-700">{fmt(p.montoNuevo)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 h-2 rounded-full bg-gray-200 overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(p.pctNuevo, 100)}%` }} />
                            </div>
                            <span className="font-bold text-blue-700 tabular-nums text-xs">{fmtPct(p.pctNuevo)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t bg-gray-50">
                  <tr>
                    <td className="px-4 py-3 font-semibold">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700">{fmt(resultado.fondoNuevo)}</td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <button onClick={() => { setResultado(null); setTab("transferir"); cargar(); }}
            className="rounded-xl border px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Nueva transferencia
          </button>
        </div>
      )}

      {/* Tab historial */}
      {tab === "historial" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Historial de movimientos del fondo</h2>
            <button onClick={cargarHistorial} disabled={loadingHistorial}
              className="rounded-lg border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
              {loadingHistorial ? "Cargando..." : "Actualizar"}
            </button>
          </div>

          {loadingHistorial && <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">Cargando historial...</div>}

          {!loadingHistorial && historial.length === 0 && (
            <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-400">
              No hay movimientos de fondo registrados en esta ronda
            </div>
          )}

          {!loadingHistorial && historial.length > 0 && (() => {
            const tipoCfg: Record<string, { label: string; color: string; bg: string; signo: string }> = {
              INVERSION:  { label: "Inversión",  color: "text-blue-700",    bg: "bg-blue-50",    signo: "→" },
              DEVOLUCION: { label: "Devolución", color: "text-emerald-700", bg: "bg-emerald-50", signo: "←" },
              INTERES:    { label: "Interés",    color: "text-amber-700",   bg: "bg-amber-50",   signo: "+" },
            };
            const totalInv = historial.filter(m => m.tipo === "INVERSION").reduce((s: number, m: any) => s + m.monto, 0);
            const totalDev = historial.filter(m => m.tipo === "DEVOLUCION").reduce((s: number, m: any) => s + m.monto, 0);
            const totalInt = historial.filter(m => m.tipo === "INTERES").reduce((s: number, m: any) => s + m.monto, 0);

            return (
              <>
                {/* Resumen */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <p className="text-[10px] text-blue-600 font-medium uppercase">Total invertido</p>
                    <p className="text-lg font-bold text-blue-800 tabular-nums">{fmt(totalInv)}</p>
                    <p className="text-[10px] text-blue-500">{historial.filter(m => m.tipo === "INVERSION").length} movimientos</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-[10px] text-emerald-600 font-medium uppercase">Total devuelto</p>
                    <p className="text-lg font-bold text-emerald-800 tabular-nums">{fmt(totalDev)}</p>
                    <p className="text-[10px] text-emerald-500">{historial.filter(m => m.tipo === "DEVOLUCION").length} movimientos</p>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-[10px] text-amber-600 font-medium uppercase">Total intereses</p>
                    <p className="text-lg font-bold text-amber-800 tabular-nums">{fmt(totalInt)}</p>
                    <p className="text-[10px] text-amber-500">{historial.filter(m => m.tipo === "INTERES").length} movimientos</p>
                  </div>
                </div>

                {/* Tabla */}
                <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-[500px] w-full text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-4 py-3 text-left">Fecha</th>
                          <th className="px-4 py-3 text-left">Socio</th>
                          <th className="px-4 py-3 text-center">Tipo</th>
                          <th className="px-4 py-3 text-right">Monto</th>
                          <th className="px-4 py-3 text-left">Nota</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historial.map((m: any, i: number) => {
                          const cfg = tipoCfg[m.tipo] ?? { label: m.tipo, color: "text-gray-600", bg: "bg-gray-50", signo: "·" };
                          const fecha = new Date(m.createdAt);
                          const fmtD = new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(fecha);
                          return (
                            <tr key={m.id} className={cn("border-t", i % 2 === 1 && "bg-gray-50/40")}>
                              <td className="px-4 py-2.5 text-gray-600 text-xs">{fmtD}</td>
                              <td className="px-4 py-2.5">
                                <p className="font-medium text-gray-800 text-xs">{m.socio?.nombres} {m.socio?.apellidos}</p>
                                <p className="text-[10px] text-gray-400 font-mono">{m.socio?.numeroCuenta}</p>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", cfg.bg, cfg.color)}>
                                  {cfg.signo} {cfg.label}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums font-medium">{fmt(m.monto)}</td>
                              <td className="px-4 py-2.5 text-xs text-gray-500 truncate max-w-[200px]">{m.nota ?? "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Modal confirmación */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30">
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-lg">→</span>
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-bold text-gray-900">Confirmar transferencia</h4>
                <p className="text-sm text-gray-600 mt-1">
                  ¿Transferir <strong className="text-blue-700">{fmt(totalTransferir)}</strong> de ahorros al fondo de inversión?
                </p>
                <div className="mt-2 rounded-lg bg-gray-50 p-2.5 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">Fondo actual</span><span className="font-medium">{fmt(fondoActual)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">A transferir</span><span className="font-medium text-violet-700">+{fmt(totalTransferir)}</span></div>
                  <div className="flex justify-between border-t pt-1"><span className="text-gray-500">Fondo nuevo</span><span className="font-bold text-blue-700">{fmt(fondoActual + totalTransferir)}</span></div>
                  <p className="text-gray-400 mt-1">Los porcentajes de participación se recalcularán automáticamente.</p>
                </div>

                {/* Fecha de la transferencia */}
                <div className="mt-3">
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">
                    Fecha de la transferencia
                    <span className="ml-1 font-normal text-gray-400">— se registrará en el historial del socio</span>
                  </label>
                  <input
                    type="date"
                    value={fechaTransferencia}
                    onChange={e => setFechaTransferencia(e.target.value)}
                    className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmOpen(false)} className="flex-1 rounded-xl border py-2.5 text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={ejecutarTransferencia} disabled={saving || !fechaTransferencia}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Transfiriendo…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
