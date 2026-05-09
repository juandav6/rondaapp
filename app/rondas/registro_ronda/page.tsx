// app/rondas/registro_ronda/page.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Socio = {
  id: number;
  nombres: string;
  apellidos: string;
  numeroCuenta: string;
  saldoAhorros?: number; // saldo libre actual
};

type Ronda = {
  id: number;
  nombre: string;
  montoAporte: number | string;
  fechaInicio: string;
  ahorroObjetivo: number | string;
  fechaFin?: string | null;
  intervaloDiasCobro: number;
  fechaInicioISO?: string;
  fechaInicioDate?: string;
  fechaFinISO?: string | null;
  fechaFinDate?: string | null;
};

type CrearRondaPayload = {
  montoAporte: number;
  fechaInicio: string;
  ahorroObjetivo: number;
  intervaloDiasCobro: number;
};

// Aporte de inversión por socio
type AporteInversion = {
  socioId: number;
  monto: number; // lo que decide aportar (≤ saldoAhorros)
};

const fmtMoney = (n: number | string, currency = "USD", locale = "es-EC") =>
  new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(n) || 0);

const fmtDate = (iso: string | null | undefined, locale = "es-EC") => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(d);
};

const fmtDateFull = (d: Date | null, locale = "es-EC") =>
  d ? new Intl.DateTimeFormat(locale, { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(d) : "-";

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

// ─── Pasos ───────────────────────────────────────────────────────────────────
type Paso = 1 | 2 | 3;

export default function RegistrarRondaPage() {
  const [paso, setPaso] = useState<Paso>(1);

  // ── datos generales ──
  const [socios, setSocios] = useState<Socio[]>([]);
  const [seleccion, setSeleccion] = useState<number[]>([]);
  const [orden, setOrden] = useState<number[]>([]);
  const [rondaCreada, setRondaCreada] = useState<Ronda | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<CrearRondaPayload>({
    montoAporte: 0,
    fechaInicio: "",
    ahorroObjetivo: 0,
    intervaloDiasCobro: 7,
  });

  // ── paso 2: orden ──
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [savingOrden, setSavingOrden] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // ── paso 3: inversión ──
  const [aportesInversion, setAportesInversion] = useState<Record<number, number>>({});
  const [savingInversion, setSavingInversion] = useState(false);
  const [inversionGuardada, setInversionGuardada] = useState(false);

  const fechaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/socios")
      .then(r => r.json())
      .then(list => setSocios(Array.isArray(list) ? list : []))
      .catch(() => setSocios([]));
  }, []);

  // Inicializar montos de inversión cuando llegamos al paso 3
  useEffect(() => {
    if (paso !== 3) return;
    const init: Record<number, number> = {};
    orden.forEach(id => {
      const s = socios.find(x => x.id === id);
      // Por defecto: el total de saldoAhorros del socio
      init[id] = s?.saldoAhorros ?? 0;
    });
    setAportesInversion(init);
  }, [paso]);

  const [q, setQ] = useState("");
  const sociosFiltrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return socios;
    return socios.filter(x => [x.nombres, x.apellidos, x.numeroCuenta].some(v => v.toLowerCase().includes(s)));
  }, [socios, q]);

  const toggleSocio = (id: number) =>
    setSeleccion(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const seleccionarTodos = () => setSeleccion(sociosFiltrados.map(s => s.id));
  const limpiarSeleccion = () => setSeleccion([]);

  const totalAportarPorSocio = seleccion.length * (form.montoAporte || 0);
  const ahorroFinalPorSocio = form.ahorroObjetivo || 0;

  // ── PASO 1 → crear ronda + participantes ──────────────────────────────────
  async function crearRondaYParticipantes() {
    try {
      setError(null);
      setLoading(true);

      const resR = await fetch("/api/rondas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          montoAporte: form.montoAporte,
          fechaInicio: form.fechaInicio,
          ahorroObjetivo: form.ahorroObjetivo,
          intervaloDiasCobro: form.intervaloDiasCobro,
        }),
      });
      const dataR = await resR.json();
      if (!resR.ok) throw new Error(dataR?.error || "No se pudo crear la ronda");
      const ronda = dataR as Ronda;

      const resP = await fetch(`/api/rondas/${ronda.id}/participantes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sociosIds: seleccion }),
      });
      const dataP = await resP.json();
      if (!resP.ok) throw new Error(dataP?.error || "No se pudieron agregar participantes");

      let ordenIds: number[] = (dataP as any)?.ordenIds ?? [];
      if (!ordenIds.length) ordenIds = [...seleccion].sort(() => Math.random() - 0.5);
      setOrden(ordenIds);

      const fechaInicioNorm =
        (ronda as any).fechaInicioISO || ronda.fechaInicio || (ronda as any).fechaInicioDate || form.fechaInicio;
      const fechaFinNorm: string | null =
        (dataP as any)?.fechaFin ||
        (ronda as any).fechaFinISO ||
        ((ronda as any).fechaFinDate ? `${(ronda as any).fechaFinDate}T12:00:00Z` : null);

      setRondaCreada({
        ...ronda,
        fechaInicio: typeof fechaInicioNorm === "string" && !fechaInicioNorm.includes("T")
          ? `${fechaInicioNorm}T12:00:00Z` : fechaInicioNorm,
        fechaFin: fechaFinNorm,
        intervaloDiasCobro: (ronda as any).intervaloDiasCobro ?? form.intervaloDiasCobro,
      });

      setPaso(2);
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  // ── PASO 2: guardar orden ─────────────────────────────────────────────────
  async function guardarOrden() {
    if (!rondaCreada) return;
    try {
      setSavingOrden(true);
      setSavedMsg(null);
      const res = await fetch(`/api/rondas/${rondaCreada.id}/orden`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordenIds: orden }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar el orden");
      setRondaCreada(rc => rc ? {
        ...rc,
        fechaFin: data?.fechaFinISO || (data?.fechaFinDate ? `${data.fechaFinDate}T12:00:00Z` : rc.fechaFin ?? null),
      } : rc);
      setSavedMsg("¡Orden guardado!");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingOrden(false);
    }
  }

  // ── PASO 3: guardar inversiones ───────────────────────────────────────────
  async function guardarInversiones() {
    if (!rondaCreada) return;
    try {
      setSavingInversion(true);
      setError(null);

      // Validar que ningún monto exceda el saldoAhorros del socio
      for (const id of orden) {
        const socio = socios.find(s => s.id === id);
        const monto = aportesInversion[id] ?? 0;
        if (monto < 0) throw new Error(`El monto de ${socio?.nombres} no puede ser negativo`);
        if (socio?.saldoAhorros != null && monto > socio.saldoAhorros)
          throw new Error(`${socio.nombres} solo tiene ${fmtMoney(socio.saldoAhorros)} disponible en ahorros`);
      }

      const res = await fetch(`/api/rondas/${rondaCreada.id}/inversion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aportes: orden.map(id => ({ socioId: id, monto: aportesInversion[id] ?? 0 })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo registrar la inversión");
      setInversionGuardada(true);
    } catch (e: any) {
      setError(e?.message ?? "Error al guardar inversiones");
    } finally {
      setSavingInversion(false);
    }
  }

  // ── drag & drop ───────────────────────────────────────────────────────────
  function onDragStart(i: number) { setDragIndex(i); }
  function onDragOver(e: React.DragEvent<HTMLLIElement>) { e.preventDefault(); }
  function onDrop(overIndex: number) {
    if (dragIndex === null || dragIndex === overIndex) return;
    setOrden(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(overIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
    setSavedMsg(null);
  }
  function handleSwapClick(i: number) {
    if (swapIndex === null) { setSwapIndex(i); return; }
    if (swapIndex === i) { setSwapIndex(null); return; }
    setOrden(prev => {
      const next = [...prev];
      [next[swapIndex], next[i]] = [next[i], next[swapIndex]];
      return next;
    });
    setSwapIndex(null);
    setSavedMsg(null);
  }
  function moveUp(i: number) {
    if (i <= 0) return;
    setOrden(prev => { const n = [...prev]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; });
    setSavedMsg(null);
  }
  function moveDown(i: number) {
    setOrden(prev => {
      if (i >= prev.length - 1) return prev;
      const n = [...prev]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n;
    });
    setSavedMsg(null);
  }

  // ── datos derivados ───────────────────────────────────────────────────────
  const participantesOrdenados = orden.map(id => socios.find(s => s.id === id)).filter(Boolean) as Socio[];

  const fechaInicioSrc = rondaCreada
    ? (rondaCreada.fechaInicio || rondaCreada.fechaInicioISO || rondaCreada.fechaInicioDate || form.fechaInicio)
    : form.fechaInicio;

  const intervalo = Number(rondaCreada?.intervaloDiasCobro ?? form.intervaloDiasCobro ?? 7);
  const fechaPrevistaPorIdx = (idx: number) => fmtDateFull(addDays(fechaInicioSrc, idx * intervalo));

  const fechaFinTexto = rondaCreada?.fechaFin
    ? fmtDate(rondaCreada.fechaFin)
    : (addDays(fechaInicioSrc, Math.max(0, (orden.length - 1) * intervalo))
        ? fmtDate(addDays(fechaInicioSrc, Math.max(0, (orden.length - 1) * intervalo))!.toISOString())
        : "-");

  // totales inversión
  const totalFondoInversion = Object.values(aportesInversion).reduce((a, b) => a + Number(b || 0), 0);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6 p-6">

      {/* ── Stepper ── */}
      {rondaCreada && (
        <div className="flex items-center gap-2 rounded-xl border bg-white px-6 py-4 shadow-sm">
          {([
            { n: 1, label: "Ronda y participantes" },
            { n: 2, label: "Orden de recepción" },
            { n: 3, label: "Fondo de inversión" },
          ] as const).map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              {i > 0 && <div className="h-px w-8 bg-gray-200" />}
              <button
                onClick={() => paso > s.n && setPaso(s.n)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  paso === s.n ? "bg-blue-600 text-white" :
                  paso > s.n ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer" :
                  "bg-gray-100 text-gray-400 cursor-default"
                )}
              >
                <span className={cn(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold",
                  paso === s.n ? "bg-white/20" : paso > s.n ? "bg-emerald-200" : "bg-gray-200"
                )}>
                  {paso > s.n ? "✓" : s.n}
                </span>
                {s.label}
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

      {/* ══════════════════ PASO 1 ══════════════════ */}
      {paso === 1 && (
        <>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /></svg>
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Registrar nueva ronda</h1>
                <p className="text-sm text-gray-600">Paso 1: configura los datos y selecciona participantes.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Form ronda */}
            <section className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Información de la ronda</h2>
              <div className="grid gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Monto por aporte semanal</label>
                  <input type="number" min={0} value={form.montoAporte || ""}
                    onChange={e => setForm(f => ({ ...f, montoAporte: Number(e.target.value) }))}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="0.00" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Ahorro objetivo por socio</label>
                  <input type="number" min={0} value={form.ahorroObjetivo || ""}
                    onChange={e => setForm(f => ({ ...f, ahorroObjetivo: Number(e.target.value) }))}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="0.00" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Fecha de inicio</label>
                  <input ref={fechaRef} type="date" value={form.fechaInicio}
                    onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Intervalo de cobro (días)</label>
                  <input type="number" min={1} value={form.intervaloDiasCobro || ""}
                    onChange={e => setForm(f => ({ ...f, intervaloDiasCobro: Number(e.target.value) }))}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="7" />
                  <p className="mt-1 text-xs text-gray-500">7 = semanal · 15 = quincenal · 30 = mensual</p>
                </div>
              </div>

              <div className="mt-4 rounded-md border bg-gray-50 px-3 py-2 text-xs text-gray-700">
                {seleccion.length
                  ? <>{seleccion.length} socios · Total por socio: <strong>{fmtMoney(totalAportarPorSocio)}</strong></>
                  : "Selecciona socios para ver totales"}
              </div>

              <button onClick={crearRondaYParticipantes}
                disabled={loading || !form.fechaInicio || !form.montoAporte || !seleccion.length}
                className={cn("mt-4 w-full rounded-lg px-4 py-2 text-sm font-medium text-white",
                  loading || !form.fechaInicio || !form.montoAporte || !seleccion.length
                    ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700")}>
                {loading ? "Creando…" : "Crear ronda y sortear orden →"}
              </button>
            </section>

            {/* Listado socios */}
            <section className="lg:col-span-2 rounded-xl border bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold">Participantes</h2>
                <input className="w-full rounded-md border px-3 py-2 text-sm focus:border-violet-500 focus:outline-none sm:w-64"
                  placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} />
                <button onClick={seleccionarTodos} className="rounded-md border px-2.5 py-1.5 text-sm hover:bg-gray-50">Todos</button>
                <button onClick={limpiarSeleccion} className="rounded-md border px-2.5 py-1.5 text-sm hover:bg-gray-50">Limpiar</button>
              </div>

              <ul className="divide-y rounded-lg border">
                {sociosFiltrados.map(s => {
                  const checked = seleccion.includes(s.id);
                  return (
                    <li key={s.id} className={cn("flex items-center justify-between gap-3 p-3", checked && "bg-blue-50/40")}>
                      <label className="flex flex-1 cursor-pointer items-center gap-3">
                        <input type="checkbox" className="h-4 w-4" checked={checked} onChange={() => toggleSocio(s.id)} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">{s.nombres} {s.apellidos}</p>
                          <p className="truncate text-xs text-gray-500">Cuenta {s.numeroCuenta}</p>
                        </div>
                      </label>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Saldo ahorros</p>
                        <p className="text-sm font-semibold text-emerald-700">{fmtMoney(s.saldoAhorros ?? 0)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {form.fechaInicio && seleccion.length > 0 && (
                <div className="mt-4 rounded-lg border bg-gray-50 p-4 text-sm">
                  <p className="mb-2 font-semibold text-gray-700">Fechas previstas (estimación)</p>
                  <ol className="space-y-1 text-gray-600">
                    {seleccion.map((_, idx) => (
                      <li key={idx}>Turno {idx + 1}: {fmtDateFull(addDays(form.fechaInicio, idx * form.intervaloDiasCobro))}</li>
                    ))}
                  </ol>
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {/* ══════════════════ PASO 2 ══════════════════ */}
      {paso === 2 && rondaCreada && (
        <>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Ronda {rondaCreada.nombre} · Orden de recepción</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Inicio: <strong>{fmtDate(rondaCreada.fechaInicio)}</strong>
                  <span className="mx-2 text-gray-400">→</span>
                  Fin: <strong>{fechaFinTexto}</strong>
                </p>
              </div>
              <button onClick={() => setPaso(3)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Continuar al fondo →
              </button>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Orden de recepción del dinero</h2>
              <div className="flex items-center gap-2">
                {swapIndex !== null && (
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                    Selecciona otra persona para intercambiar
                  </span>
                )}
                <button onClick={guardarOrden} disabled={savingOrden}
                  className={cn("rounded-md px-3 py-2 text-sm text-white", savingOrden ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700")}>
                  {savingOrden ? "Guardando…" : "Guardar orden"}
                </button>
              </div>
            </div>

            {savedMsg && <div className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{savedMsg}</div>}

            <ol className="space-y-2">
              {participantesOrdenados.map((s, idx) => (
                <li key={s.id}
                  className={cn("flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-gray-50", swapIndex === idx && "ring-2 ring-yellow-300")}
                  draggable onDragStart={() => onDragStart(idx)} onDragOver={onDragOver} onDrop={() => onDrop(idx)}>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700">{idx + 1}</span>
                    <div>
                      <p className="font-medium text-gray-900">{s.nombres} {s.apellidos}</p>
                      <p className="text-xs text-gray-500">Cuenta {s.numeroCuenta}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => moveUp(idx)} className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50">↑</button>
                    <button onClick={() => moveDown(idx)} className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50">↓</button>
                    <button onClick={() => handleSwapClick(idx)}
                      className={cn("rounded-md border px-2 py-1 text-xs", swapIndex === idx ? "bg-yellow-100 text-yellow-800" : "hover:bg-gray-50")}>
                      Intercambiar
                    </button>
                    <span className="whitespace-nowrap text-sm text-gray-600">
                      Recibe: {fmtMoney((Number(form.montoAporte) || 0) * (orden.length || 0))}
                      <span className="mx-2 text-gray-300">•</span>
                      {fechaPrevistaPorIdx(idx)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}

      {/* ══════════════════ PASO 3 ══════════════════ */}
      {paso === 3 && rondaCreada && (
        <>
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Fondo de inversión · {rondaCreada.nombre}</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Define cuánto destina cada socio al fondo de préstamos. El resto permanece en su cuenta de ahorros.
                </p>
              </div>
              {inversionGuardada && (
                <Link href="/rondas/actual" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                  Ir a Ronda Actual →
                </Link>
              )}
            </div>
          </div>

          {/* Tabla de inversión */}
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b bg-gray-50 px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">Aporte al fondo de préstamos</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Fondo total: <strong className="text-blue-700">{fmtMoney(totalFondoInversion)}</strong>
                  {totalFondoInversion > 0 && <> · Los porcentajes se calculan automáticamente</>}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => {
                  // Poner el máximo posible a todos
                  const max: Record<number, number> = {};
                  orden.forEach(id => { const s = socios.find(x => x.id === id); max[id] = s?.saldoAhorros ?? 0; });
                  setAportesInversion(max);
                }} className="rounded-md border px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                  Máximo a todos
                </button>
                <button onClick={() => {
                  const cero: Record<number, number> = {};
                  orden.forEach(id => { cero[id] = 0; });
                  setAportesInversion(cero);
                }} className="rounded-md border px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                  Limpiar
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
                  <tr>
                    <th className="px-4 py-3">Socio</th>
                    <th className="px-4 py-3 text-right">Saldo ahorros</th>
                    <th className="px-4 py-3 text-right">Aporte a inversión</th>
                    <th className="px-4 py-3 text-right">Queda en ahorros</th>
                    <th className="px-4 py-3 text-right">% participación</th>
                  </tr>
                </thead>
                <tbody>
                  {participantesOrdenados.map(s => {
                    const saldo = s.saldoAhorros ?? 0;
                    const aporte = aportesInversion[s.id] ?? 0;
                    const resta = saldo - aporte;
                    const pct = totalFondoInversion > 0 ? (aporte / totalFondoInversion) * 100 : 0;
                    const excede = aporte > saldo;

                    return (
                      <tr key={s.id} className={cn("border-t", excede && "bg-red-50")}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{s.nombres} {s.apellidos}</p>
                          <p className="text-xs text-gray-500 font-mono">{s.numeroCuenta}</p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-emerald-700">
                          {fmtMoney(saldo)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {excede && <span className="text-xs text-red-600 font-medium">⚠️ Excede</span>}
                            <input
                              type="number" min={0} max={saldo} step="0.01"
                              value={aporte ?? ""}
                              onChange={e => {
                                const raw = e.target.value;
                                const num = raw === "" ? 0 : Number(raw);
                              
                                const v = Math.min(num, saldo);
                              
                                setAportesInversion(prev => ({
                                  ...prev,
                                  [s.id]: v,
                                }));
                              }}
                              className={cn(
                                "w-32 rounded-md border px-2 py-1.5 text-right text-sm tabular-nums focus:outline-none focus:ring-2",
                                excede ? "border-red-300 focus:ring-red-200" : "focus:ring-blue-200"
                              )}
                              placeholder="0.00"
                            />
                          </div>
                        </td>
                        <td className={cn("px-4 py-3 text-right tabular-nums", resta < 0 ? "text-red-600 font-medium" : "text-gray-700")}>
                          {fmtMoney(Math.max(0, resta))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                              <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="tabular-nums text-sm font-medium text-blue-700">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t bg-gray-50">
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {fmtMoney(participantesOrdenados.reduce((a, s) => a + (s.saldoAhorros ?? 0), 0))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-blue-700">
                      {fmtMoney(totalFondoInversion)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {fmtMoney(participantesOrdenados.reduce((a, s) => a + Math.max(0, (s.saldoAhorros ?? 0) - (aportesInversion[s.id] ?? 0)), 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-blue-700">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="border-t bg-blue-50 px-6 py-4">
              <p className="text-xs text-blue-800">
                💡 El monto que cada socio destine a inversión quedará <strong>bloqueado</strong> hasta el cierre de la ronda,
                momento en que recibirá su capital más los intereses generados proporcionalmente.
                El saldo restante permanece libre en su cuenta de ahorros y puede retirarse en cualquier momento.
              </p>
            </div>
          </div>

          {/* Botón guardar */}
          {!inversionGuardada ? (
            <div className="flex justify-end gap-3">
              <button onClick={() => setPaso(2)} className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                ← Volver al orden
              </button>
              <button onClick={guardarInversiones} disabled={savingInversion || totalFondoInversion === 0}
                className={cn("rounded-lg px-6 py-2 text-sm font-medium text-white",
                  savingInversion || totalFondoInversion === 0 ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700")}>
                {savingInversion ? "Guardando…" : "Confirmar fondo de inversión"}
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
              <h2 className="text-lg font-semibold text-emerald-800">✅ Ronda lista para iniciar</h2>
              <p className="mt-1 text-sm text-emerald-700">
                El fondo de inversión de <strong>{fmtMoney(totalFondoInversion)}</strong> ha sido registrado.
                Los saldos de ahorros han sido actualizados.
              </p>
              <div className="mt-4 flex gap-3">
                <Link href="/rondas/actual" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                  Ir a Ronda Actual
                </Link>
                <Link href="/prestamos/solicitud" className="rounded-lg border border-emerald-300 px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-100">
                  Crear primer préstamo
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
