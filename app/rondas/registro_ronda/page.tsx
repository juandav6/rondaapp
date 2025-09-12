// app/rondas/registro_ronda/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Socio = { id: number; nombres: string; apellidos: string; numeroCuenta: string };
type Ronda = { id: number; codigo: string; nombre: string; montoAporte: number; fechaInicio: string; ahorroObjetivo: number; fechaFin?: string | null };

// NOTA: hacemos 'codigo' opcional en el payload; el backend lo generará al crear.
type CrearRondaPayload = {
  // codigo?: string;  // <- se omite para que lo genere el backend
  nombre: string;
  montoAporte: number;
  fechaInicio: string;
  ahorroObjetivo: number;
};

const fmtMoney = (n: number, currency = "USD", locale = "es-EC") =>
  new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(n || 0);

const fmtDate = (iso: string | null | undefined, locale = "es-EC") => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(d);
};

const classNames = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ===== Componente =====
export default function RegistrarRondaPage() {
  const [socios, setSocios] = useState<Socio[]>([]);
  const [seleccion, setSeleccion] = useState<number[]>([]);
  const [orden, setOrden] = useState<number[]>([]); // ids en orden de recibir

  const [form, setForm] = useState<CrearRondaPayload>({
    // codigo: "",  // <- ya no se usa en el formulario
    nombre: "",
    montoAporte: 0,
    fechaInicio: "",
    ahorroObjetivo: 0,
  });

  const [rondaCreada, setRondaCreada] = useState<Ronda | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // estados para reordenar
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [savingOrden, setSavingOrden] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // Carga inicial de socios (SIN solicitar secuencial)
  useEffect(() => {
    fetch("/api/socios")
      .then((r) => r.json())
      .then((list) => setSocios(Array.isArray(list) ? list : []))
      .catch(() => setSocios([]));
  }, []);

  // Búsqueda de socios
  const [q, setQ] = useState("");
  const sociosFiltrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return socios;
    return socios.filter((x) =>
      [x.nombres, x.apellidos, x.numeroCuenta].some((v) => String(v).toLowerCase().includes(s))
    );
  }, [socios, q]);

  // Selección
  const toggleSocio = (id: number) =>
    setSeleccion((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const seleccionarTodos = () => setSeleccion(sociosFiltrados.map((s) => s.id));
  const limpiarSeleccion = () => setSeleccion([]);

  // Cálculos informativos
  const totalSocios = seleccion.length;
  const totalAportarPorSocio = totalSocios * (form.montoAporte || 0); // asumiendo 1 aporte por socio por ciclo
  const ahorroFinalPorSocio = form.ahorroObjetivo || 0;

  // Crear ronda + participantes + sorteo
  async function crearRondaYParticipantes() {
    try {
      setError(null);
      setLoading(true);

      // 1) Crear ronda (sin enviar 'codigo'; el backend lo genera)
      const resR = await fetch("/api/rondas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Enviamos únicamente los campos necesarios (sin codigo)
        body: JSON.stringify({
          nombre: form.nombre,
          montoAporte: form.montoAporte,
          fechaInicio: form.fechaInicio,
          ahorroObjetivo: form.ahorroObjetivo,
        }),
      });
      const dataR = await resR.json();
      if (!resR.ok) throw new Error(dataR?.error || "No se pudo crear la ronda");

      const ronda: Ronda = dataR;

      // 2) Participantes + sorteo (el backend podría devolver el orden). Si no, hacemos shuffle local.
      const resP = await fetch(`/api/rondas/${ronda.id}/participantes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sociosIds: seleccion }),
      });
      const dataP = await resP.json();
      if (!resP.ok) throw new Error(dataP?.error || "No se pudieron agregar participantes");


      // Orden desde backend o local
      let ordenIds: number[] | undefined = dataP?.ordenIds;
      if (!Array.isArray(ordenIds) || !ordenIds.length) {
        // shuffle local
        ordenIds = [...seleccion].sort(() => Math.random() - 0.5);
      }

      setOrden(ordenIds);
      setRondaCreada({ ...ronda, fechaFin: dataP?.fechaFin ?? ronda.fechaFin ?? null });
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  // ==== Reordenamiento (drag & drop) ====
  function onDragStart(index: number) {
    setDragIndex(index);
  }
  function onDragOver(e: React.DragEvent<HTMLLIElement>) {
    e.preventDefault(); // necesario para permitir drop
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

  // ==== Reordenamiento (swap click a click) ====
  function handleSwapClick(index: number) {
    if (swapIndex === null) {
      setSwapIndex(index);
    } else if (swapIndex === index) {
      setSwapIndex(null); // cancelar
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

  // Acciones rápidas ↑ / ↓
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

  // Guardar nuevo orden en backend
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

    return (
      <div className="space-y-6">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                {/* Icono */}
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path d="M4 6a2 2 0 0 1 2-2h2.5a1 1 0 0 1 .8.4l1.4 1.8H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" />
                  </svg>
                </span>
                ¡Ronda creada!
              </h1>
              <p className="mt-1 text-gray-600">Puedes comenzar a registrar aportes.</p>
            </div>
            <Link href="/rondas/actual" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Ir a Ronda Actual
            </Link>
          </div>

          {/* Resumen de la ronda */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-4">
              <p className="text-xs text-gray-500">Código</p>
              <p className="mt-1 font-semibold">{rondaCreada.codigo}</p>
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
                {fmtDate(rondaCreada.fechaInicio)}
                <span className="mx-2 text-gray-400">→</span>
                {fmtDate(rondaCreada.fechaFin ?? null)}
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
                    {/* grip */}
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
                    <button
                      onClick={() => moveUp(idx)}
                      className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                      aria-label="Subir"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveDown(idx)}
                      className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                      aria-label="Bajar"
                    >
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
                      Recibe: {fmtMoney((form.montoAporte || 0) * (orden.length || 0))}
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Registrar nueva ronda</h1>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      )}

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

          <div className="grid gap-3">
            {/* Campo de código removido: el secuencial se genera al guardar */}
            <div className="rounded-md border bg-gray-50 px-3 py-2 text-xs text-gray-700">
              El código de la ronda se generará automáticamente al guardar.
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                <label className="mb-1 block text-sm font-medium text-gray-700">Nombre de la ronda</label>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: Ronda familiar julio"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                />
              </div>
            </div>

            <div className="rounded-md border bg-gray-50 px-3 py-2 text-xs text-gray-700">
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
              disabled={loading || !form.fechaInicio || !form.montoAporte || !seleccion.length || !form.nombre}
              className={classNames(
                "mt-2 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-white",
                loading || !form.fechaInicio || !form.montoAporte || !seleccion.length || !form.nombre
                  ? "bg-blue-400 opacity-70"
                  : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/><path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4"/></svg>
                  Creando…
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12 2a10 10 0 1 0 10 10A10.012 10.012 0 0 0 12 2Zm1 14.59 5.3-5.3a1 1 0 0 0-1.42-1.42L13 13.76l-2.3-2.29a1 1 0 0 0-1.42 1.42l3 3a1 1 0 0 0 1.42 0Z"/></svg>
                  Crear ronda y sortear orden
                </>
              )}
            </button>
          </div>
        </section>

        {/* Listado de socios (vertical) */}
        <section className="lg:col-span-2 rounded-xl border bg-white p-6 shadow-sm">
          <header className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm-7 8a7 7 0 0 1 14 0"/></svg>
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
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={checked}
                        onChange={() => toggleSocio(s.id)}
                      />
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

          {/* Pie con totales */}
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
            <div className="text-xs text-gray-500">Consejo: puedes filtrar y luego "Seleccionar todo" para elegir por segmentos.</div>
          </div>
        </section>
      </div>
    </div>
  );
}


