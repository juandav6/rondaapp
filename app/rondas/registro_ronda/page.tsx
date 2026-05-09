// app/rondas/registro_ronda/page.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Socio = {
  id: number; nombres: string; apellidos: string;
  numeroCuenta: string; saldoAhorros?: number;
};

type CrearRondaPayload = {
  montoAporte: number; fechaInicio: string;
  ahorroObjetivo: number; intervaloDiasCobro: number;
};

const fmt = (n: number | string) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n) || 0);

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" }).format(d);
};

const fmtDateFull = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("es-EC", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(d) : "-";

const addDays = (iso: string | Date, days: number) => {
  if (!iso) return null;
  const base = typeof iso === "string"
    ? (iso.includes("T") ? new Date(iso) : new Date(`${iso}T12:00:00Z`))
    : new Date(iso);
  if (Number.isNaN(base.getTime())) return null;
  const noon = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 12, 0, 0));
  noon.setUTCDate(noon.getUTCDate() + days);
  return noon;
};

const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Paso = 1 | 2 | 3;

export default function RegistrarRondaPage() {
  const [paso, setPaso] = useState<Paso>(1);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [q, setQ] = useState("");
  const [seleccion, setSeleccion] = useState<number[]>([]);   // socios en la ronda
  const [orden, setOrden] = useState<number[]>([]);           // orden de recepción
  const [aportesInversion, setAportesInversion] = useState<Record<number, number>>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [rondaCreada, setRondaCreada] = useState<{ id: number; nombre: string } | null>(null);

  const [form, setForm] = useState<CrearRondaPayload>({
    montoAporte: 0, fechaInicio: "", ahorroObjetivo: 0, intervaloDiasCobro: 7,
  });

  const fechaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/socios").then(r => r.json()).then(l => setSocios(Array.isArray(l) ? l : [])).catch(() => setSocios([]));
  }, []);

  // Socios con saldo > 0 (para el fondo de inversión)
  const sociosConSaldo = useMemo(() => socios.filter(s => (s.saldoAhorros ?? 0) > 0), [socios]);

  // Al pasar al paso 2, inicializar inversiones con el saldoAhorros de cada socio con saldo
  useEffect(() => {
    if (paso !== 2) return;
    setAportesInversion(prev => {
      const hasValues = sociosConSaldo.some(s => (prev[s.id] ?? 0) > 0);
      if (hasValues) return prev;
      const init: Record<number, number> = {};
      sociosConSaldo.forEach(s => { init[s.id] = s.saldoAhorros ?? 0; });
      return init;
    });
  }, [paso, sociosConSaldo]);

  const sociosFiltrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return socios;
    return socios.filter(x => [x.nombres, x.apellidos, x.numeroCuenta].some(v => v.toLowerCase().includes(s)));
  }, [socios, q]);

  const participantesOrdenados = orden.map(id => socios.find(s => s.id === id)).filter(Boolean) as Socio[];
  const totalFondo = sociosConSaldo.reduce((a, s) => a + Number(aportesInversion[s.id] ?? 0), 0);

  // Set de socios que participan en la ronda (para etiquetas)
  const sociosEnRondaSet = useMemo(() => new Set(seleccion), [seleccion]);

  const toggleSocio = (id: number) => {
    setSeleccion(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    setOrden(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const seleccionarTodos = () => {
    const ids = sociosFiltrados.map(s => s.id);
    setSeleccion(ids); setOrden(ids);
  };
  const limpiarSeleccion = () => { setSeleccion([]); setOrden([]); };

  // drag & drop
  function onDragStart(i: number) { setDragIndex(i); }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); }
  function onDrop(i: number) {
    if (dragIndex === null || dragIndex === i) return;
    setOrden(prev => { const n = [...prev]; const [m] = n.splice(dragIndex, 1); n.splice(i, 0, m); return n; });
    setDragIndex(null);
  }
  function handleSwap(i: number) {
    if (swapIndex === null) { setSwapIndex(i); return; }
    if (swapIndex === i) { setSwapIndex(null); return; }
    setOrden(prev => { const n = [...prev]; [n[swapIndex], n[i]] = [n[i], n[swapIndex]]; return n; });
    setSwapIndex(null);
  }
  function moveUp(i: number) { if (i <= 0) return; setOrden(prev => { const n = [...prev]; [n[i-1], n[i]] = [n[i], n[i-1]]; return n; }); }
  function moveDown(i: number) { setOrden(prev => { if (i >= prev.length-1) return prev; const n = [...prev]; [n[i+1], n[i]] = [n[i], n[i+1]]; return n; }); }

  const paso1Valido = form.fechaInicio && form.montoAporte > 0 && seleccion.length > 0;
  const paso2Valido = sociosConSaldo.every(s => {
    const a = aportesInversion[s.id] ?? 0;
    return a >= 0 && a <= (s.saldoAhorros ?? 0);
  });

  const fechaFinEstimada = form.fechaInicio && orden.length > 0
    ? addDays(form.fechaInicio, Math.max(0, orden.length - 1) * form.intervaloDiasCobro)
    : null;

  // ── CREAR RONDA ───────────────────────────────────────────────────────────
  async function crearRonda() {
    try {
      setCreando(true); setError(null);

      const r1 = await fetch("/api/rondas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ montoAporte: form.montoAporte, fechaInicio: form.fechaInicio, ahorroObjetivo: form.ahorroObjetivo, intervaloDiasCobro: form.intervaloDiasCobro }),
      });
      const ronda = await r1.json();
      if (!r1.ok) throw new Error(ronda?.error || "No se pudo crear la ronda");

      const r2 = await fetch(`/api/rondas/${ronda.id}/participantes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sociosIds: orden }),
      });
      const p2 = await r2.json();
      if (!r2.ok) throw new Error(p2?.error || "Error al agregar participantes");

      const r3 = await fetch(`/api/rondas/${ronda.id}/orden`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordenIds: orden }),
      });
      if (!r3.ok) { const d = await r3.json(); throw new Error(d?.error || "Error al guardar el orden"); }

      // Inversiones: todos los socios con aporte > 0
      const aportesConMonto = sociosConSaldo.filter(s => (aportesInversion[s.id] ?? 0) > 0);
      if (aportesConMonto.length > 0) {
        const r4 = await fetch(`/api/rondas/${ronda.id}/inversion`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            aportes: sociosConSaldo.map(s => ({ socioId: s.id, monto: aportesInversion[s.id] ?? 0 })),
          }),
        });
        const d4 = await r4.json();
        if (!r4.ok) throw new Error(d4?.error || "Error al registrar inversiones");
      }

      setRondaCreada({ id: ronda.id, nombre: ronda.nombre });
    } catch (e: any) {
      setError(e?.message ?? "Error al crear la ronda");
    } finally {
      setCreando(false);
    }
  }

  // ── ÉXITO ─────────────────────────────────────────────────────────────────
  if (rondaCreada) {
    return (
      <div className="p-6">
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-8 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-emerald-600">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-emerald-800 mb-2">¡Ronda {rondaCreada.nombre} creada!</h1>
          <p className="text-emerald-700 mb-6">Lista con participantes, orden de recepción y fondo de inversión.</p>
          <div className="flex justify-center gap-3">
            <Link href="/rondas/actual" className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">Ir a Ronda Actual</Link>
            <Link href="/prestamos/solicitud" className="rounded-lg border border-emerald-300 px-5 py-2.5 text-sm text-emerald-700 hover:bg-emerald-100">Crear primer préstamo</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Stepper */}
      <div className="rounded-xl border bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-2">
          {([
            { n: 1 as Paso, label: "Configuración y orden" },
            { n: 2 as Paso, label: "Fondo de inversión" },
            { n: 3 as Paso, label: "Confirmar y crear" },
          ]).map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              {i > 0 && <div className={cn("h-px w-8", paso > s.n ? "bg-emerald-300" : paso === s.n ? "bg-blue-300" : "bg-gray-200")} />}
              <button onClick={() => paso > s.n ? setPaso(s.n) : undefined}
                className={cn("flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  paso === s.n ? "bg-blue-600 text-white" :
                  paso > s.n ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer" :
                  "bg-gray-100 text-gray-400 cursor-default")}>
                <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold",
                  paso === s.n ? "bg-white/20" : paso > s.n ? "bg-emerald-200" : "bg-gray-200")}>
                  {paso > s.n ? "✓" : s.n}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

      {/* ══ PASO 1 ══ */}
      {paso === 1 && (
        <>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold mb-1">Nueva ronda · Paso 1</h1>
            <p className="text-sm text-gray-500">Configura los parámetros, selecciona participantes y define el orden de recepción.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <section className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-gray-800">Parámetros</h2>
              <div className="grid gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Monto por aporte</label>
                  <input type="number" min={0} value={form.montoAporte || ""} placeholder="0.00"
                    onChange={e => setForm(f => ({ ...f, montoAporte: Number(e.target.value) }))}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Ahorro objetivo por socio</label>
                  <input type="number" min={0} value={form.ahorroObjetivo || ""} placeholder="0.00"
                    onChange={e => setForm(f => ({ ...f, ahorroObjetivo: Number(e.target.value) }))}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Fecha de inicio</label>
                  <input ref={fechaRef} type="date" value={form.fechaInicio}
                    onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Intervalo de cobro (días)</label>
                  <input type="number" min={1} value={form.intervaloDiasCobro || ""} placeholder="7"
                    onChange={e => setForm(f => ({ ...f, intervaloDiasCobro: Number(e.target.value) }))}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  <p className="mt-1 text-xs text-gray-400">7 = semanal · 15 = quincenal · 30 = mensual</p>
                </div>
              </div>
              {seleccion.length > 0 && (
                <div className="mt-4 space-y-1.5 rounded-lg bg-gray-50 border p-3 text-xs text-gray-600">
                  <div className="flex justify-between"><span>Participantes</span><strong>{seleccion.length}</strong></div>
                  <div className="flex justify-between"><span>Total por socio</span><strong>{fmt(seleccion.length * (form.montoAporte || 0))}</strong></div>
                  {fechaFinEstimada && <div className="flex justify-between"><span>Fin estimado</span><strong>{fmtDate(fechaFinEstimada.toISOString())}</strong></div>}
                </div>
              )}
            </section>

            <section className="lg:col-span-2 rounded-xl border bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h2 className="text-base font-semibold text-gray-800">Participantes y orden</h2>
                <input className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none sm:w-60"
                  placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} />
                <button onClick={seleccionarTodos} className="rounded-md border px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50">Todos</button>
                <button onClick={limpiarSeleccion} className="rounded-md border px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50">Limpiar</button>
              </div>

              <ul className="divide-y rounded-lg border max-h-56 overflow-y-auto mb-4">
                {sociosFiltrados.map(s => {
                  const checked = seleccion.includes(s.id);
                  return (
                    <li key={s.id} className={cn("flex items-center justify-between gap-3 p-3", checked && "bg-blue-50/40")}>
                      <label className="flex flex-1 cursor-pointer items-center gap-3">
                        <input type="checkbox" className="h-4 w-4" checked={checked} onChange={() => toggleSocio(s.id)} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">{s.nombres} {s.apellidos}</p>
                          <p className="truncate text-xs text-gray-400 font-mono">{s.numeroCuenta}</p>
                        </div>
                      </label>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-gray-400">Ahorros</p>
                        <p className="text-sm font-semibold text-emerald-700">{fmt(s.saldoAhorros ?? 0)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {orden.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-700">Orden de recepción</h3>
                    <span className="text-xs text-gray-400">Arrastra para reordenar</span>
                  </div>
                  <ol className="space-y-1.5 max-h-56 overflow-y-auto">
                    {participantesOrdenados.map((s, idx) => (
                      <li key={s.id}
                        className={cn("flex items-center justify-between gap-2 rounded-lg border p-2.5 bg-white hover:bg-gray-50 cursor-grab text-sm", swapIndex === idx && "ring-2 ring-yellow-300")}
                        draggable onDragStart={() => onDragStart(idx)} onDragOver={onDragOver} onDrop={() => onDrop(idx)}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{idx + 1}</span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900">{s.nombres} {s.apellidos}</p>
                            {form.fechaInicio && <p className="text-xs text-gray-400">{fmtDateFull(addDays(form.fechaInicio, idx * form.intervaloDiasCobro))}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => moveUp(idx)} className="rounded border px-1.5 py-0.5 text-xs hover:bg-gray-100">↑</button>
                          <button onClick={() => moveDown(idx)} className="rounded border px-1.5 py-0.5 text-xs hover:bg-gray-100">↓</button>
                          <button onClick={() => handleSwap(idx)}
                            className={cn("rounded border px-2 py-0.5 text-xs", swapIndex === idx ? "bg-yellow-100 text-yellow-800" : "hover:bg-gray-100")}>⇄</button>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>
          </div>

          <div className="flex justify-end">
            <button onClick={() => setPaso(2)} disabled={!paso1Valido}
              className={cn("rounded-lg px-6 py-2.5 text-sm font-medium text-white",
                !paso1Valido ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700")}>
              Continuar al fondo de inversión →
            </button>
          </div>
        </>
      )}

      {/* ══ PASO 2: Fondo de inversión ══ */}
      {paso === 2 && (
        <>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold mb-1">Nueva ronda · Paso 2</h1>
            <p className="text-sm text-gray-500">
              Define cuánto destina cada socio al fondo de préstamos.
              Se muestran <strong>todos los socios con saldo disponible</strong>, participen o no en esta ronda.
            </p>
            <div className="mt-3 flex items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-gray-600">Participa en la ronda</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-2 w-2 rounded-full bg-amber-400" />
                <span className="text-gray-600">Solo fondo de inversión</span>
              </span>
            </div>
          </div>

          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b bg-gray-50 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">Aporte al fondo de préstamos</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Fondo total: <strong className="text-blue-700">{fmt(totalFondo)}</strong>
                  <span className="mx-2 text-gray-300">·</span>
                  {sociosConSaldo.length} socios con saldo disponible
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => {
                  const max: Record<number, number> = {};
                  sociosConSaldo.forEach(s => { max[s.id] = s.saldoAhorros ?? 0; });
                  setAportesInversion(max);
                }} className="rounded-md border px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                  Máximo a todos
                </button>
                <button onClick={() => {
                  const c: Record<number, number> = {};
                  sociosConSaldo.forEach(s => { c[s.id] = 0; });
                  setAportesInversion(c);
                }} className="rounded-md border px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                  Limpiar
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Socio</th>
                    <th className="px-4 py-3 text-right">Saldo ahorros</th>
                    <th className="px-4 py-3 text-right">Aporte a inversión</th>
                    <th className="px-4 py-3 text-right">Queda en ahorros</th>
                    <th className="px-4 py-3 text-right">% participación</th>
                  </tr>
                </thead>
                <tbody>
                  {sociosConSaldo.map(s => {
                    const saldo = s.saldoAhorros ?? 0;
                    const aporte = aportesInversion[s.id] ?? 0;
                    const resta = saldo - aporte;
                    const pct = totalFondo > 0 ? (aporte / totalFondo) * 100 : 0;
                    const excede = aporte > saldo;
                    const enRonda = sociosEnRondaSet.has(s.id);

                    return (
                      <tr key={s.id} className={cn("border-t", excede && "bg-red-50/50")}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900 truncate">{s.nombres} {s.apellidos}</p>
                                {enRonda ? (
                                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                    En ronda
                                  </span>
                                ) : (
                                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                    Solo fondo
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 font-mono">{s.numeroCuenta}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-emerald-700">{fmt(saldo)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {excede && <span className="text-xs text-red-600">⚠️</span>}
                            <input type="number" min={0} max={saldo} step="0.01" value={aporte || ""}
                              onChange={e => { const v = Math.min(Number(e.target.value || 0), saldo); setAportesInversion(p => ({ ...p, [s.id]: v })); }}
                              className={cn("w-32 rounded-md border px-2 py-1.5 text-right text-sm tabular-nums focus:outline-none focus:ring-2",
                                excede ? "border-red-300 focus:ring-red-200" : "focus:ring-blue-200")}
                              placeholder="0.00" />
                          </div>
                          {excede && <p className="text-xs text-red-600 mt-0.5 text-right">Excede saldo</p>}
                        </td>
                        <td className={cn("px-4 py-3 text-right tabular-nums", resta < 0 ? "text-red-600" : "text-gray-700")}>
                          {fmt(Math.max(0, resta))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                              <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="text-sm font-medium text-blue-700 tabular-nums">{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t bg-gray-50">
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmt(sociosConSaldo.reduce((a, s) => a + (s.saldoAhorros ?? 0), 0))}</td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700 tabular-nums">{fmt(totalFondo)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmt(sociosConSaldo.reduce((a, s) => a + Math.max(0, (s.saldoAhorros ?? 0) - (aportesInversion[s.id] ?? 0)), 0))}</td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="border-t bg-blue-50 px-5 py-3 flex items-start gap-6 text-xs text-blue-700">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-2 w-2 rounded-full bg-blue-500" />
                <strong>{seleccion.length}</strong> socios en la ronda
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-2 w-2 rounded-full bg-amber-400" />
                <strong>{sociosConSaldo.filter(s => !sociosEnRondaSet.has(s.id)).length}</strong> socios solo en el fondo
              </span>
              <span>💡 El monto invertido queda bloqueado hasta el cierre de la ronda.</span>
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setPaso(1)} className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">← Volver</button>
            <button onClick={() => setPaso(3)} disabled={!paso2Valido}
              className={cn("rounded-lg px-6 py-2.5 text-sm font-medium text-white",
                !paso2Valido ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700")}>
              Ver resumen y confirmar →
            </button>
          </div>
        </>
      )}

      {/* ══ PASO 3: Resumen ══ */}
      {paso === 3 && (
        <>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold mb-1">Resumen · Confirmar creación</h1>
            <p className="text-sm text-gray-500">Revisa todos los parámetros antes de crear la ronda.</p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Monto por aporte", value: fmt(form.montoAporte) },
              { label: "Ahorro objetivo", value: fmt(form.ahorroObjetivo) },
              { label: "Fecha de inicio", value: fmtDate(form.fechaInicio) },
              { label: "Fin estimado", value: fechaFinEstimada ? fmtDate(fechaFinEstimada.toISOString()) : "-" },
              { label: "Participantes en ronda", value: String(seleccion.length) },
              { label: "Socios en fondo", value: String(sociosConSaldo.filter(s => (aportesInversion[s.id] ?? 0) > 0).length) },
              { label: "Fondo de inversión", value: fmt(totalFondo), highlight: true },
              { label: "Intervalo", value: `${form.intervaloDiasCobro} días` },
            ].map(k => (
              <div key={k.label} className={cn("rounded-xl border p-4 shadow-sm", k.highlight ? "border-blue-200 bg-blue-50" : "bg-white")}>
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className={cn("mt-1 text-lg font-semibold", k.highlight ? "text-blue-700" : "text-gray-900")}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Orden */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Orden de recepción ({seleccion.length} socios)</h3>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {participantesOrdenados.map((s, idx) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2 text-sm">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{idx + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">{s.nombres} {s.apellidos}</p>
                    {form.fechaInicio && <p className="text-xs text-gray-400">{fmtDateFull(addDays(form.fechaInicio, idx * form.intervaloDiasCobro))}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fondo */}
          {totalFondo > 0 && (
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Fondo de inversión · {fmt(totalFondo)}
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  ({sociosConSaldo.filter(s => (aportesInversion[s.id] ?? 0) > 0).length} socios)
                </span>
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-gray-400">
                    <tr>
                      <th className="pb-2">Socio</th>
                      <th className="pb-2 text-center">Tipo</th>
                      <th className="pb-2 text-right">Monto</th>
                      <th className="pb-2 text-right">% Part.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sociosConSaldo.filter(s => (aportesInversion[s.id] ?? 0) > 0).map(s => {
                      const enRonda = sociosEnRondaSet.has(s.id);
                      return (
                        <tr key={s.id}>
                          <td className="py-2 font-medium text-gray-900">{s.nombres} {s.apellidos}</td>
                          <td className="py-2 text-center">
                            {enRonda
                              ? <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" />En ronda</span>
                              : <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Solo fondo</span>
                            }
                          </td>
                          <td className="py-2 text-right tabular-nums text-blue-700 font-medium">{fmt(aportesInversion[s.id] ?? 0)}</td>
                          <td className="py-2 text-right tabular-nums text-gray-600">{totalFondo > 0 ? (((aportesInversion[s.id] ?? 0) / totalFondo) * 100).toFixed(1) : 0}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            ⚠️ Al confirmar se creará la ronda, se registrarán los participantes y se transferirán los montos de inversión. Esta acción no se puede deshacer.
          </div>

          <div className="flex justify-between">
            <button onClick={() => setPaso(2)} className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">← Volver</button>
            <button onClick={crearRonda} disabled={creando}
              className={cn("rounded-lg px-8 py-3 text-sm font-semibold text-white shadow-sm",
                creando ? "bg-emerald-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700")}>
              {creando ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/>
                    <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4"/>
                  </svg>
                  Creando ronda…
                </span>
              ) : "✓ Confirmar y crear ronda"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
