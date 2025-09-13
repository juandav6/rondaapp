// app/rondas/registro_ronda/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Socio = { id: number; nombres: string; apellidos: string; numeroCuenta: string };

// En la API tu “código” viene en `nombre` (RD0001, etc.)
type Ronda = {
  id: number;
  nombre: string; // código generado
  montoAporte: number | string;
  fechaInicio: string;               // ← usaremos SIEMPRE este campo en la UI (ISO)
  ahorroObjetivo: number | string;
  fechaFin?: string | null;          // ISO o null
  intervaloDiasCobro: number;

  // opcionales que pueden venir de la API (por compatibilidad)
  fechaInicioISO?: string;
  fechaInicioDate?: string;
  fechaFinISO?: string | null;
  fechaFinDate?: string | null;
};

type CrearRondaPayload = {
  montoAporte: number;
  fechaInicio: string;               // "YYYY-MM-DD"
  ahorroObjetivo: number;
  intervaloDiasCobro: number;
};

const fmtMoney = (n: number, currency = "USD", locale = "es-EC") =>
  new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(n || 0);

const fmtDate = (iso: string | null | undefined, locale = "es-EC") => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(d);
};

const fmtDateFull = (d: Date | null, locale = "es-EC") =>
  d ? new Intl.DateTimeFormat(locale, { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(d) : "-";

// Anclado a 12:00 UTC para evitar desfaces de día por zona horaria.
const addDays = (iso: string | Date, days: number) => {
  if (!iso) return null;
  const base =
    typeof iso === "string"
      ? (iso.includes("T") ? new Date(iso) : new Date(`${iso}T12:00:00Z`))
      : new Date(iso);
  if (Number.isNaN(base.getTime())) return null;
  const noon = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 12, 0, 0));
  noon.setUTCDate(noon.getUTCDate() + days);
  return noon;
};

const classNames = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export default function RegistrarRondaPage() {
  const [socios, setSocios] = useState<Socio[]>([]);
  const [seleccion, setSeleccion] = useState<number[]>([]);
  const [orden, setOrden] = useState<number[]>([]);

  const [form, setForm] = useState<CrearRondaPayload>({
    montoAporte: 0,
    fechaInicio: "",
    ahorroObjetivo: 0,
    intervaloDiasCobro: 7, // por defecto semanal
  });

  const [rondaCreada, setRondaCreada] = useState<Ronda | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [savingOrden, setSavingOrden] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/socios")
      .then((r) => r.json())
      .then((list) => setSocios(Array.isArray(list) ? list : []))
      .catch(() => setSocios([]));
  }, []);

  const [q, setQ] = useState("");
  const sociosFiltrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return socios;
    return socios.filter((x) =>
      [x.nombres, x.apellidos, x.numeroCuenta].some((v) => String(v).toLowerCase().includes(s))
    );
  }, [socios, q]);

  const toggleSocio = (id: number) =>
    setSeleccion((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const seleccionarTodos = () => setSeleccion(sociosFiltrados.map((s) => s.id));
  const limpiarSeleccion = () => setSeleccion([]);

  const totalSocios = seleccion.length;
  const totalAportarPorSocio = totalSocios * (form.montoAporte || 0);
  const ahorroFinalPorSocio = form.ahorroObjetivo || 0;

  // Crear ronda + participantes + sorteo
  async function crearRondaYParticipantes() {
    try {
      setError(null);
      setLoading(true);

      // 1) Crear ronda (el backend genera el código y lo guarda en `nombre`)
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

      // 2) Participantes + sorteo
      const resP = await fetch(`/api/rondas/${ronda.id}/participantes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sociosIds: seleccion }),
      });
      const dataP = await resP.json();
      if (!resP.ok) throw new Error(dataP?.error || "No se pudieron agregar participantes");

      // Orden desde backend o local
      let ordenIds: number[] | undefined = (dataP as any)?.ordenIds;
      if (!Array.isArray(ordenIds) || !ordenIds.length) {
        ordenIds = [...seleccion].sort(() => Math.random() - 0.5);
      }
      setOrden(ordenIds);

      // ==== Normalizar fechas para el estado ====
      const fechaInicioNorm =
        (ronda as any).fechaInicioISO ||
        (ronda as any).fechaInicio ||
        (ronda as any).fechaInicioDate ||
        form.fechaInicio; // "YYYY-MM-DD" fallback

      const fechaFinNorm: string | null =
        (dataP as any)?.fechaFin ||
        (ronda as any).fechaFinISO ||
        ((ronda as any).fechaFinDate ? `${(ronda as any).fechaFinDate}T12:00:00Z` : null);

      setRondaCreada({
        ...ronda,
        fechaInicio:
          typeof fechaInicioNorm === "string" && !fechaInicioNorm.includes("T")
            ? `${fechaInicioNorm}T12:00:00Z`
            : (fechaInicioNorm as string),
        fechaFin: fechaFinNorm,
        intervaloDiasCobro: (ronda as any).intervaloDiasCobro ?? form.intervaloDiasCobro,
      });
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  // Drag & drop
  function onDragStart(index: number) {
    setDragIndex(index);
  }
  function onDragOver(e: React.DragEvent<HTMLLIElement>) {
    e.preventDefault();
  }
  function onDrop(overIndex: number) {
    if (dragIndex === null || dragIndex === overIndex) return;
    setOrden((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(overIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
    setSavedMsg(null);
  }

  function handleSwapClick(index: number) {
    if (swapIndex === null) {
      setSwapIndex(index);
    } else if (swapIndex === index) {
      setSwapIndex(null);
    } else {
      setOrden((prev) => {
        const next = [...prev];
        [next[swapIndex], next[index]] = [next[index], next[swapIndex]];
        return next;
      });
      setSwapIndex(null);
      setSavedMsg(null);
    }
  }

  function moveUp(i: number) {
    if (i <= 0) return;
    setOrden((prev) => {
      const next = [...prev];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });
    setSavedMsg(null);
  }
  function moveDown(i: number) {
    setOrden((prev) => {
      if (i >= prev.length - 1) return prev;
      const next = [...prev];
      [next[i + 1], next[i]] = [next[i], next[i + 1]];
      return next;
    });
    setSavedMsg(null);
  }

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
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar el nuevo orden");

      // ← Actualiza la fechaFin en el estado con lo que recalcula la API
      setRondaCreada((rc) =>
        rc
          ? {
              ...rc,
              fechaFin:
                data?.fechaFinISO ||
                (data?.fechaFinDate ? `${data.fechaFinDate}T12:00:00Z` : rc.fechaFin ?? null),
            }
          : rc
      );

      setSavedMsg("¡Nuevo orden guardado!");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingOrden(false);
    }
  }

  // ===== UI =====
  if (rondaCreada) {
    const participantesOrdenados = orden
      .map((id) => socios.find((s) => s.id === id))
      .filter(Boolean) as Socio[];

    // Usa la fuente normalizada para todos los cálculos
    const fechaInicioSrc =
      rondaCreada.fechaInicio ||
      rondaCreada.fechaInicioISO ||
      rondaCreada.fechaInicioDate ||
      form.fechaInicio;

    const intervalo = Number(rondaCreada.intervaloDiasCobro ?? form.intervaloDiasCobro ?? 7);

    const fechaPrevistaPorIdx = (idx: number) => fmtDateFull(addDays(fechaInicioSrc, idx * intervalo));
    const fechaFinEstimadaDate = addDays(fechaInicioSrc, Math.max(0, (orden.length - 1) * intervalo));

    const fechaInicioTexto = fmtDate(
      typeof fechaInicioSrc === "string" && !fechaInicioSrc.includes("T")
        ? `${fechaInicioSrc}T12:00:00Z`
        : (fechaInicioSrc as string)
    );

    const fechaFinTexto =
      (rondaCreada.fechaFin && fmtDate(rondaCreada.fechaFin)) ||
      (fechaFinEstimadaDate ? fmtDate(fechaFinEstimadaDate.toISOString()) : "-");

    return (
      <div className="space-y-6">
        {/* Encabezado + resumen */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path d="M4 6a2 2 0 0 1 2-2h2.5a1 1 0 0 1 .8.4l1.4 1.8H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" />
                  </svg>
                </span>
                ¡Ronda creada!
              </h1>
              <p className="mt-1 text-gray-600">Puedes comenzar a registrar aportes.</p>
            </div>
            <Link
              href="/rondas/actual"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Ir a Ronda Actual
            </Link>
          </div>

          {/* Resumen de la ronda */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-4">
              <p className="text-xs text-gray-500">Código</p>
              <p className="mt-1 font-semibold">{rondaCreada.nombre}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-gray-500">Total a aportar por socio</p>
              <p className="mt-1 text-xl font-semibold">{fmtMoney(totalAportarPorSocio)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-gray-500">Ahorro objetivo por socio</p>
              <p className="mt-1 text-xl font-semibold">{fmtMoney(ahorroFinalPorSocio)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-gray-500">Periodo</p>
              <p className="mt-1 font-semibold">
                {fechaInicioTexto}
                <span className="mx-2 text-gray-400">→</span>
                {fechaFinTexto}
              </p>
            </div>
          </div>
        </div>

        {/* Orden de socios */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M12 2a10 10 0 1 0 10 10A10.012 10.012 0 0 0 12 2Zm1 5a1 1 0 0 0-2 0v5a1 1 0 0 0 .553.894l3 1.5a1 1 0 0 0 .894-1.788L13 11.382Z"/>
                </svg>
              </span>
              <h2 className="text-lg font-semibold">Orden de recepción del dinero</h2>
            </div>
            <div className="flex items-center gap-2">
              {swapIndex !== null && (
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                  Selecciona otra persona para intercambiar
                </span>
              )}
              <button
                onClick={guardarOrden}
                disabled={savingOrden}
                className={classNames(
                  "rounded-md px-3 py-2 text-sm text-white",
                  savingOrden ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {savingOrden ? "Guardando…" : "Guardar orden"}
              </button>
            </div>
          </div>

          {savedMsg && (
            <div className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              {savedMsg}
            </div>
          )}

          {participantesOrdenados.length === 0 ? (
            <p className="text-gray-600">No hay participantes.</p>
          ) : (
            <ol className="space-y-2">
              {participantesOrdenados.map((s, idx) => (
                <li
                  key={s.id}
                  className={classNames(
                    "flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-gray-50",
                    swapIndex === idx && "ring-2 ring-yellow-300"
                  )}
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={onDragOver}
                  onDrop={() => onDrop(idx)}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
                      {idx + 1}
                    </span>
                    <button
                      className="cursor-grab text-gray-400 hover:text-gray-600"
                      title="Arrastrar para reordenar"
                      aria-label="Arrastrar"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 6h2v2H9V6Zm4 0h2v2h-2V6ZM9 10h2v2H9v-2Zm4 0h2v2h-2v-2ZM9 14h2v2H9v-2Zm4 0h2v2h-2v-2Z"/>
                      </svg>
                    </button>
                    <div>
                      <p className="font-medium text-gray-900">{s.nombres} {s.apellidos}</p>
                      <p className="text-xs text-gray-500">Cuenta {s.numeroCuenta}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button onClick={() => moveUp(idx)} className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50" aria-label="Subir">
                      ↑
                    </button>
                    <button onClick={() => moveDown(idx)} className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50" aria-label="Bajar">
                      ↓
                    </button>
                    <button
                      onClick={() => handleSwapClick(idx)}
                      className={classNames(
                        "rounded-md border px-2 py-1 text-xs",
                        swapIndex === idx ? "bg-yellow-100 text-yellow-800" : "hover:bg-gray-50"
                      )}
                      title="Intercambiar posiciones"
                    >
                      Intercambiar
                    </button>
                    <span className="text-sm text-gray-600">
                      Recibe: {fmtMoney((Number(form.montoAporte) || 0) * (orden.length || 0))}
                      <span className="mx-2 text-gray-300">•</span>
                      Fecha prevista: {fechaPrevistaPorIdx(idx)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    );
  }

  // Vista inicial (sin ronda creada)
  return (
    <div className="space-y-6">
      {/* Cajón de título */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
            </svg>
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Registrar nueva ronda</h1>
            <p className="text-sm text-gray-600">El código se generará automáticamente al guardar.</p>
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Información de la ronda */}
        <section className="lg:col-span-1 rounded-xl border bg-white p-6 shadow-sm">
          <header className="mb-4 flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
              </svg>
            </span>
            <div>
              <h2 className="text-lg font-semibold">Información de la ronda</h2>
              <p className="text-sm text-gray-600">Completa los datos generales.</p>
            </div>
          </header>

          {/* UNA sola columna */}
          <div className="grid gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Monto por aporte</label>
              <input
                type="number"
                className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="0.00"
                min={0}
                value={form.montoAporte || ""}
                onChange={(e) => setForm((f) => ({ ...f, montoAporte: Number(e.target.value) }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Ahorro objetivo por socio</label>
              <input
                type="number"
                className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="0.00"
                min={0}
                value={form.ahorroObjetivo || ""}
                onChange={(e) => setForm((f) => ({ ...f, ahorroObjetivo: Number(e.target.value) }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Fecha de inicio</label>
              <input
                type="date"
                className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={form.fechaInicio}
                onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Cada cuántos días hay cobro</label>
              <input
                type="number"
                className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="7"
                min={1}
                value={form.intervaloDiasCobro || ""}
                onChange={(e) => setForm((f) => ({ ...f, intervaloDiasCobro: Number(e.target.value) }))}
              />
              <p className="mt-1 text-xs text-gray-500">Ej.: 7 = semanal, 15 = quincenal, 30 = mensual aproximado.</p>
            </div>
          </div>

          <div className="mt-3 rounded-md border bg-gray-50 px-3 py-2 text-xs text-gray-700">
            {seleccion.length ? (
              <>
                {seleccion.length} socios • Total por socio al final: <strong>{fmtMoney(totalAportarPorSocio)}</strong>
              </>
            ) : (
              <span>Selecciona socios para ver totales</span>
            )}
          </div>

          <button
            onClick={crearRondaYParticipantes}
            disabled={loading || !form.fechaInicio || !form.montoAporte || !seleccion.length}
            className={classNames(
              "mt-3 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-white",
              loading || !form.fechaInicio || !form.montoAporte || !seleccion.length
                ? "bg-blue-400 opacity-70"
                : "bg-blue-600 hover:bg-blue-700"
            )}
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                  <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" />
                </svg>
                Creando…
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M12 2a10 10 0 1 0 10 10A10.012 10.012 0 0 0 12 2Zm1 14.59 5.3-5.3a1 1 0 0 0-1.42-1.42L13 13.76l-2.3-2.29a1 1 0 0 0-1.42 1.42l3 3a1 1 0 0 0 1.42 0Z"/>
                </svg>
                Crear ronda y sortear orden
              </>
            )}
          </button>
        </section>

        {/* Listado de socios */}
        <section className="lg:col-span-2 rounded-xl border bg-white p-6 shadow-sm">
          <header className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm-7 8a7 7 0 0 1 14 0"/>
                </svg>
              </span>
              <div>
                <h2 className="text-lg font-semibold">Listado de socios</h2>
                <p className="text-sm text-gray-600">Selecciona quiénes participarán en la ronda.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  className="w-56 rounded-md border px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                  placeholder="Buscar por nombre o cuenta…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">⌘K</span>
              </div>
              <button onClick={seleccionarTodos} className="rounded-md border px-2.5 py-1.5 text-sm hover:bg-gray-50">Seleccionar todo</button>
              <button onClick={limpiarSeleccion} className="rounded-md border px-2.5 py-1.5 text-sm hover:bg-gray-50">Limpiar</button>
            </div>
          </header>

          {sociosFiltrados.length === 0 ? (
            <p className="text-gray-600">No hay socios.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {sociosFiltrados.map((s) => {
                const checked = seleccion.includes(s.id);
                return (
                  <li key={s.id} className={classNames("flex items-center justify-between gap-3 p-3", checked && "bg-gray-50")}>
                    <label className="flex flex-1 cursor-pointer items-center gap-3">
                      <input type="checkbox" className="h-4 w-4" checked={checked} onChange={() => toggleSocio(s.id)} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{s.nombres} {s.apellidos}</p>
                        <p className="truncate text-xs text-gray-500">Cuenta {s.numeroCuenta}</p>
                      </div>
                    </label>
                    {checked && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Seleccionado</span>}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-700">
            <div>
              <span className="font-medium">{seleccion.length}</span> seleccionados
              {seleccion.length > 0 && (
                <>
                  <span className="mx-2 text-gray-400">•</span>
                  Total por socio al final: <strong>{fmtMoney(totalAportarPorSocio)}</strong>
                  <span className="mx-2 text-gray-400">•</span>
                  Ahorro objetivo: <strong>{fmtMoney(ahorroFinalPorSocio)}</strong>
                </>
              )}
            </div>
            <div className="text-xs text-gray-500">Consejo: puedes filtrar y luego “Seleccionar todo”.</div>
          </div>

          {/* Preview opcional de fechas previstas antes de crear (con el orden actual de selección) */}
          {form.fechaInicio && form.intervaloDiasCobro && seleccion.length > 0 && (
            <div className="mt-4 rounded-lg border bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold">Fechas previstas (estimación)</h3>
              <ol className="space-y-1 text-sm text-gray-700">
                {seleccion.map((_, idx) => (
                  <li key={idx}>Turno {idx + 1}: {fmtDateFull(addDays(form.fechaInicio, idx * form.intervaloDiasCobro))}</li>
                ))}
              </ol>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
