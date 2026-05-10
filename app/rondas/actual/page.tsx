// app/rondas/actual/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n) || 0);

const fmtDateFull = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("es-EC", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(d) : "-";

const addDaysUTC = (baseISO: string, days: number) => {
  if (!baseISO) return null;
  const base = baseISO.includes("T") ? new Date(baseISO) : new Date(`${baseISO}T12:00:00Z`);
  if (Number.isNaN(base.getTime())) return null;
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 12, 0, 0));
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Item = {
  socioId: number;
  socio: { nombres: string; apellidos: string; numeroCuenta: string };
  orden: number; pagado: boolean; monto: string | null; multa: string;
  ahorroAcumulado: string; ahorroRestante: string; ahorroSemana?: string;
};
type RondaDTO = {
  id: number; nombre: string; semanaActual: number; montoAporte: string;
  ahorroObjetivoPorSocio?: string; responsableId?: number | null;
  fechaInicio?: string; fechaInicioISO?: string; fechaInicioDate?: string;
  intervaloDiasCobro?: number;
};
type EstadoSemana = {
  ronda: RondaDTO; semana: number; totalParticipantes: number; items: Item[];
  totalAportesSemana?: string; totalAhorrosSemana?: string; responsableId?: number | null;
};
type Toast = { text: string; type: "success" | "error" | "info" | "warning" };

export default function RondaActualPage() {
  const [estado, setEstado] = useState<EstadoSemana | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [pendientes, setPendientes] = useState<any[]>([]);
  const [ahorroInputs, setAhorroInputs] = useState<Record<number, number>>({});
  const [multasInputs, setMultasInputs] = useState<Record<number, number>>({});
  const [obsInputs, setObsInputs] = useState<Record<number, string>>({});
  const [responsableId, setResponsableId] = useState<number | "">("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [loanOpen, setLoanOpen] = useState(false);
  const [loanSaving, setLoanSaving] = useState(false);
  const [loanSocio, setLoanSocio] = useState<{ id: number; nombres: string; apellidos: string } | null>(null);
  const [loanPrincipal, setLoanPrincipal] = useState(0);
  const [loanInteres, setLoanInteres] = useState(0);
  const [loanObs, setLoanObs] = useState("");

  const showToast = (text: string, type: Toast["type"] = "success", ms = 2500) => {
    setToast({ text, type });
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(null), ms);
  };

  function openLoanModal(p: { socioId: number; socio: Item["socio"]; montoAporte: string }) {
    setLoanSocio({ id: p.socioId, nombres: p.socio.nombres, apellidos: p.socio.apellidos });
    setLoanPrincipal(Number(p.montoAporte || 0));
    setLoanInteres(0); setLoanObs(obsInputs[p.socioId] ?? ""); setLoanOpen(true);
  }

  async function crearPrestamoExpress() {
    if (!estado || !loanSocio) return;
    try {
      setLoanSaving(true);
      const res = await fetch("/api/prestamos/express", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rondaId: estado.ronda.id, semana: estado.semana, socioId: loanSocio.id, principal: loanPrincipal, interes: loanInteres, observaciones: loanObs || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error");
      const res2 = await fetch(`/api/rondas/${estado.ronda.id}/aportes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socioId: loanSocio.id, semana: estado.semana, monto: Number(estado.ronda.montoAporte), multa: 0, prestamoExpressId: data.id, fuente: "prestamoExpress", observaciones: loanObs || undefined }),
      });
      const data2 = await res2.json().catch(() => ({}));
      if (!res2.ok) throw new Error(data2?.error || "Error");
      setLoanOpen(false); showToast("Préstamo express registrado"); await cargar();
    } catch (e: any) { showToast(e?.message || "Error", "error", 4000); }
    finally { setLoanSaving(false); }
  }

  useEffect(() => { cargar(); }, []);
  useEffect(() => { setAhorroInputs({}); setMultasInputs({}); setObsInputs({}); }, [estado?.semana, estado?.ronda?.id]);
  useEffect(() => { if (estado) setResponsableId(estado.responsableId ?? estado.ronda?.responsableId ?? ""); }, [estado?.responsableId, estado?.ronda?.responsableId]);

  async function cargar() {
    try {
      setError(null);
      const r = await fetch("/api/rondas", { cache: "no-store" });
      if (r.status === 204) { setEstado(null); return; }
      const ronda = await r.json();
      const e = await fetch(`/api/rondas/${ronda.id}/semana/${ronda.semanaActual}/aportes`, { cache: "no-store" });
      setEstado(await e.json()); setPendientes([]);
    } catch (e: any) { setError(e.message); setEstado(null); }
  }

  async function registrarAhorroParcial(socioId: number, monto: number) {
    if (!estado || monto <= 0) { showToast("Monto debe ser mayor a 0", "error"); return; }
    try {
      setSaving(socioId);
      const res = await fetch(`/api/rondas/${estado.ronda.id}/ahorros`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socioId, semana: estado.semana, monto }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error");
      setEstado(prev => {
        if (!prev) return prev;
        const items = prev.items.map(row => {
          if (row.socioId !== socioId) return row;
          const nuevoAcum = Number(row.ahorroAcumulado ?? 0) + monto;
          const obj = Number(prev.ronda.ahorroObjetivoPorSocio ?? 0);
          return { ...row, ahorroSemana: (Number(row.ahorroSemana ?? 0) + monto).toFixed(2), ahorroAcumulado: nuevoAcum.toFixed(2), ahorroRestante: Math.max(obj - nuevoAcum, 0).toFixed(2) };
        });
        return { ...prev, items, totalAhorrosSemana: items.reduce((s, r) => s + Number(r.ahorroSemana ?? 0), 0).toFixed(2) };
      });
      setAhorroInputs(p => ({ ...p, [socioId]: 0 }));
      await cargar(); showToast("Ahorro registrado");
    } catch (e: any) { showToast(e.message, "error", 4000); }
    finally { setSaving(null); }
  }

  async function registrarAporteIndividual(socioId: number) {
    if (!estado) return;
    try {
      setSaving(socioId);
      const res = await fetch(`/api/rondas/${estado.ronda.id}/aportes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socioId, semana: estado.semana, monto: Number(estado.ronda.montoAporte), multa: 0 }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || "Error"); }
      await cargar(); showToast("Aporte registrado");
    } catch (e: any) { showToast(e.message, "error", 4000); }
    finally { setSaving(null); }
  }

  async function registrarAporteTodos() {
    if (!estado) return;
    try {
      setCerrando(true);
      const results = await Promise.all(estado.items.map(it =>
        fetch(`/api/rondas/${estado.ronda.id}/aportes`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ socioId: it.socioId, semana: estado.semana, monto: Number(estado.ronda.montoAporte), multa: 0 }),
        })
      ));
      for (const r of results) if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d?.error || "Error"); }
      await cargar(); showToast("Aportes registrados para todos");
    } catch (e: any) { showToast(e.message, "error", 4000); }
    finally { setCerrando(false); }
  }

  async function cobrarPendiente(socioId: number) {
    if (!estado) return;
    try {
      setSaving(socioId);
      const res = await fetch(`/api/rondas/${estado.ronda.id}/aportes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socioId, semana: estado.semana, monto: Number(estado.ronda.montoAporte), multa: Number(multasInputs[socioId] ?? 0), observaciones: obsInputs[socioId] ?? "" }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || "Error"); }
      await cargar(); showToast("Cobro registrado");
    } catch (e: any) { showToast(e.message, "error", 4000); }
    finally { setSaving(null); }
  }

  async function guardarResponsable() {
    if (!estado || responsableId === "") { setError("Selecciona un responsable."); return; }
    try {
      const res = await fetch(`/api/rondas/${estado.ronda.id}/responsable`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socioId: Number(responsableId), semana: estado.semana }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || "Error"); }
      await cargar(); showToast("Responsable guardado");
    } catch (e: any) { showToast(e.message, "error", 4000); }
  }

  async function cerrarSemana() {
    if (!estado) return;
    try {
      setCerrando(true);
      const res = await fetch(`/api/rondas/${estado.ronda.id}/cerrar-semana`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error");
      if (data.avanzada) {
        setAhorroInputs({}); setMultasInputs({}); setObsInputs({});
        if (data.finalizada) window.location.href = `/rondas/${estado.ronda.id}/resultados`;
        else { await cargar(); showToast("Semana cerrada"); }
      } else {
        setPendientes(data.pendientes || []);
        if (data.pendientes?.length) showToast("Quedan pendientes. Usa Préstamo express.", "info", 3500);
      }
    } catch (e: any) { showToast(e.message, "error", 4000); }
    finally { setCerrando(false); }
  }

  if (!estado) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-full border bg-gray-50 mb-5">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-gray-300">
          <path fillRule="evenodd" d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2Zm-1 9V7a1 1 0 1 1 2 0v4a1 1 0 0 1-.293.707l-2.5 2.5a1 1 0 0 1-1.414-1.414L11 11Z" clipRule="evenodd"/>
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">No hay una ronda activa</h2>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">Crea una nueva ronda para comenzar.</p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <a href="/rondas/registro_ronda" className="flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">+ Crear nueva ronda</a>
        <a href="/rondas/historial" className="flex items-center justify-center rounded-lg border px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Ver historial</a>
      </div>
      {error && <p className="mt-4 text-xs text-red-500">{error}</p>}
    </div>
  );

  const itemsOrdenados = [...estado.items].sort((a, b) => a.orden - b.orden);
  const idx = itemsOrdenados.length > 0 ? ((estado.semana - 1) % itemsOrdenados.length + itemsOrdenados.length) % itemsOrdenados.length : 0;
  const actual = itemsOrdenados[idx];
  const siguiente = itemsOrdenados.length ? itemsOrdenados[(idx + 1) % itemsOrdenados.length] : undefined;
  const montoAporteNum = Number(estado.ronda.montoAporte || 0);
  const totalAportesSemana = estado.totalAportesSemana != null ? Number(estado.totalAportesSemana) : estado.items.reduce((s, it) => s + (it.pagado ? montoAporteNum : 0), 0);
  const totalAhorrosSemana = estado.totalAhorrosSemana != null ? Number(estado.totalAhorrosSemana) : estado.items.reduce((s, it) => s + Number(it.ahorroSemana ?? 0), 0);
  const opcionesResponsable = itemsOrdenados.map(it => ({ value: it.socioId, label: `${it.socio.nombres} ${it.socio.apellidos}` }));
  const baseInicio = estado.ronda.fechaInicio || estado.ronda.fechaInicioISO || (estado.ronda.fechaInicioDate ? `${estado.ronda.fechaInicioDate}T12:00:00Z` : undefined);
  const intervalo = Number(estado.ronda.intervaloDiasCobro ?? 7);
  const fechaSemanaActual = baseInicio ? addDaysUTC(baseInicio, (estado.semana - 1) * intervalo) : null;

  return (
    <div className="space-y-4">
      {toast && (
        <div role="status" className={cn("fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 text-sm shadow-lg ring-1 max-w-[calc(100vw-2rem)]",
          toast.type === "success" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" :
          toast.type === "error" ? "bg-red-50 text-red-800 ring-red-200" : "bg-blue-50 text-blue-800 ring-blue-200")}>
          {toast.text}
        </div>
      )}

      {/* Header */}
      <header className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold">Ronda: <span className="text-blue-700">{estado.ronda.nombre}</span></h1>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200">
                Sem. {estado.semana}/{estado.totalParticipantes}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
              <span>Monto: <strong>{fmtMoney(Number(estado.ronda.montoAporte))}</strong></span>
              <span>· {estado.totalParticipantes} participantes</span>
              {fechaSemanaActual && <span>· {fmtDateFull(fechaSemanaActual)}</span>}
            </div>
          </div>
          <div className="mt-2 sm:mt-0 sm:w-44">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Progreso</span>
              <span>{Math.min(estado.semana, estado.totalParticipantes)}/{estado.totalParticipantes}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full bg-blue-600 transition-[width]"
                style={{ width: `${Math.min(100, Math.max(0, ((estado.semana - 1) / Math.max(1, estado.totalParticipantes)) * 100))}%` }}/>
            </div>
          </div>
        </div>
        {actual && siguiente && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
              <p className="text-xs font-medium text-emerald-700">Cobra esta semana</p>
              <p className="mt-0.5 text-sm font-semibold text-emerald-900 truncate">{actual.socio.nombres} {actual.socio.apellidos}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
              <p className="text-xs font-medium text-amber-700">Siguiente</p>
              <p className="mt-0.5 text-sm font-semibold text-amber-900 truncate">{siguiente.socio.nombres} {siguiente.socio.apellidos}</p>
            </div>
          </div>
        )}
      </header>

      {/* KPIs + Responsable */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-gray-500">Aportes semana</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{fmtMoney(totalAportesSemana)}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-gray-500">Ahorros semana</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{fmtMoney(totalAhorrosSemana)}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-gray-500 mb-1">Responsable cobro</p>
          <div className="flex gap-2">
            <select className="w-full rounded-md border px-2 py-1.5 text-xs focus:outline-none"
              value={responsableId} onChange={e => setResponsableId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">— Selecciona —</option>
              {opcionesResponsable.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={guardarResponsable} disabled={responsableId === ""}
              className="rounded-md bg-blue-600 px-2 py-1.5 text-xs text-white disabled:opacity-50 shrink-0">✓</button>
          </div>
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="flex justify-between items-center">
        <p className="text-sm font-medium text-gray-700">Participantes</p>
        <button onClick={registrarAporteTodos} disabled={cerrando}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
          {cerrando ? "Registrando…" : "Aporte a todos"}
        </button>
      </div>

      {/* Tabla — desktop */}
      <div className="hidden md:block rounded-xl bg-white shadow overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Socio</th>
              <th className="px-3 py-2 text-right">Objetivo</th>
              <th className="px-3 py-2 text-right">Ahorrado</th>
              <th className="px-3 py-2 text-right">Dif.</th>
              <th className="px-3 py-2 text-right">Ahorro sem.</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {estado.items.map(it => {
              const objetivo = Number(estado.ronda.ahorroObjetivoPorSocio ?? 0);
              const acum = Number(it.ahorroAcumulado ?? 0);
              const dif = acum - objetivo;
              const valorInput = ahorroInputs[it.socioId] ?? "";
              const disabledAhorro = (it as any).ahorroRegistradoSemana === true || saving === it.socioId;
              return (
                <tr key={it.socioId} className="border-t">
                  <td className="px-3 py-2 text-gray-400">{it.orden}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-900">{it.socio.nombres} {it.socio.apellidos}</p>
                    <p className="text-xs text-gray-400 font-mono">{it.socio.numeroCuenta}</p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtMoney(objetivo)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-blue-700">{fmtMoney(acum)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">
                    {dif === 0 ? <span className="text-gray-300">—</span> : dif > 0 ? <span className="text-emerald-600">+{fmtMoney(dif)}</span> : <span className="text-red-500">{fmtMoney(dif)}</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input type="number" min="0" step="0.01" disabled={disabledAhorro}
                      value={valorInput === 0 ? "" : valorInput}
                      onChange={e => setAhorroInputs(p => ({ ...p, [it.socioId]: e.target.value === "" ? 0 : Number(e.target.value) }))}
                      className="w-24 rounded border px-2 py-1 text-right text-xs disabled:bg-gray-100" placeholder="0.00" />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end items-center gap-1.5 whitespace-nowrap">
                      {it.pagado ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700 font-medium">✓ Pagado</span>
                      ) : (
                        <>
                          <button disabled={saving === it.socioId} onClick={() => registrarAporteIndividual(it.socioId)}
                            className="rounded bg-brand-500 px-2.5 py-1 text-xs text-white disabled:opacity-50">
                            {saving === it.socioId ? "…" : "Aporte"}
                          </button>
                          <button onClick={() => openLoanModal({ socioId: it.socioId, socio: it.socio, montoAporte: estado.ronda.montoAporte } as any)}
                            className="rounded bg-indigo-600 px-2.5 py-1 text-xs text-white">Express</button>
                        </>
                      )}
                      <button
                        disabled={(it as any).ahorroRegistradoSemana || saving === it.socioId || !(Number(ahorroInputs[it.socioId] ?? 0) > 0)}
                        onClick={() => registrarAhorroParcial(it.socioId, Number(ahorroInputs[it.socioId] ?? 0))}
                        className="rounded bg-blue-600 px-2.5 py-1 text-xs text-white disabled:opacity-50">Ahorro</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tarjetas — móvil */}
      <div className="md:hidden rounded-xl bg-white shadow overflow-hidden">
        <div className="border-b bg-gray-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Semana {estado.semana}
        </div>
        <ul className="divide-y">
          {estado.items.map(it => {
            const objetivo = Number(estado.ronda.ahorroObjetivoPorSocio ?? 0);
            const acum = Number(it.ahorroAcumulado ?? 0);
            const dif = acum - objetivo;
            const valorInput = ahorroInputs[it.socioId] ?? "";
            const disabledAhorro = (it as any).ahorroRegistradoSemana === true || saving === it.socioId;

            return (
              <li key={it.socioId} className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{it.orden}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate text-sm">{it.socio.nombres} {it.socio.apellidos}</p>
                      <p className="text-xs text-gray-400 font-mono">{it.socio.numeroCuenta}</p>
                    </div>
                  </div>
                  {it.pagado && <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">✓ Pagado</span>}
                </div>

                {/* Stats ahorros */}
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <div className="rounded bg-gray-50 p-2 text-center">
                    <p className="text-gray-400">Objetivo</p>
                    <p className="font-semibold text-gray-700 tabular-nums mt-0.5">{fmtMoney(objetivo)}</p>
                  </div>
                  <div className="rounded bg-blue-50 p-2 text-center">
                    <p className="text-blue-400">Ahorrado</p>
                    <p className="font-bold text-blue-700 tabular-nums mt-0.5">{fmtMoney(acum)}</p>
                  </div>
                  <div className="rounded bg-gray-50 p-2 text-center">
                    <p className="text-gray-400">Dif.</p>
                    <p className={cn("font-semibold tabular-nums mt-0.5", dif > 0 ? "text-emerald-600" : dif < 0 ? "text-red-500" : "text-gray-300")}>
                      {dif === 0 ? "—" : dif > 0 ? `+${fmtMoney(dif)}` : fmtMoney(dif)}
                    </p>
                  </div>
                </div>

                {/* Botones aporte */}
                {!it.pagado && (
                  <div className="flex gap-2">
                    <button disabled={saving === it.socioId} onClick={() => registrarAporteIndividual(it.socioId)}
                      className="flex-1 rounded-lg bg-brand-500 py-2 text-xs text-white font-medium disabled:opacity-50">
                      {saving === it.socioId ? "…" : "Registrar aporte"}
                    </button>
                    <button onClick={() => openLoanModal({ socioId: it.socioId, socio: it.socio, montoAporte: estado.ronda.montoAporte } as any)}
                      className="rounded-lg bg-indigo-600 px-3 py-2 text-xs text-white font-medium">Express</button>
                  </div>
                )}

                {/* Input ahorro */}
                <div className="flex gap-2">
                  <input type="number" min="0" step="0.01" disabled={disabledAhorro}
                    value={valorInput === 0 ? "" : valorInput}
                    onChange={e => setAhorroInputs(p => ({ ...p, [it.socioId]: e.target.value === "" ? 0 : Number(e.target.value) }))}
                    className="flex-1 rounded-lg border px-3 py-2 text-sm text-right disabled:bg-gray-100" placeholder="Monto ahorro…" />
                  <button
                    disabled={(it as any).ahorroRegistradoSemana || saving === it.socioId || !(Number(ahorroInputs[it.socioId] ?? 0) > 0)}
                    onClick={() => registrarAhorroParcial(it.socioId, Number(ahorroInputs[it.socioId] ?? 0))}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs text-white font-medium disabled:opacity-50">
                    Guardar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex justify-end">
        <button onClick={cerrarSemana} disabled={cerrando}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
          {cerrando ? "Cerrando…" : "Cerrar semana"}
        </button>
      </div>

      {/* Pendientes */}
      {pendientes.length > 0 && (
        <div className="rounded-xl bg-white shadow p-4 space-y-3">
          <h3 className="text-base font-semibold text-gray-900">Pendientes de pago</h3>

          {/* Tabla desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Socio</th>
                  <th className="px-4 py-2">Aporte</th>
                  <th className="px-4 py-2">Multa</th>
                  <th className="px-4 py-2 text-left">Obs.</th>
                  <th className="px-4 py-2">Total</th>
                  <th className="px-4 py-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map((p: any) => {
                  const multa = multasInputs[p.socioId] ?? Number(p.multa ?? 0);
                  const total = (Number(p.montoAporte) + Number(multa)).toFixed(2);
                  return (
                    <tr key={p.socioId} className="border-t">
                      <td className="px-4 py-2">{p.socio.nombres} {p.socio.apellidos}</td>
                      <td className="px-4 py-2 text-center">${p.montoAporte}</td>
                      <td className="px-4 py-2">
                        <input type="number" min="0" step="0.01" className="w-20 rounded border px-2 py-1 text-right text-xs"
                          value={multa} onChange={e => setMultasInputs(p2 => ({ ...p2, [p.socioId]: Number(e.target.value || 0) }))} />
                      </td>
                      <td className="px-4 py-2">
                        <input type="text" className="w-full rounded border px-2 py-1 text-xs" placeholder="Observaciones"
                          value={obsInputs[p.socioId] ?? ""} onChange={e => setObsInputs(p2 => ({ ...p2, [p.socioId]: e.target.value }))} />
                      </td>
                      <td className="px-4 py-2 text-center font-semibold text-sm">${total}</td>
                      <td className="px-4 py-2">
                        <div className="flex justify-center gap-2">
                          <button disabled={saving === p.socioId} onClick={() => cobrarPendiente(p.socioId)}
                            className="rounded bg-emerald-600 px-3 py-1.5 text-xs text-white disabled:opacity-50">
                            {saving === p.socioId ? "…" : "Cobrar"}
                          </button>
                          <button onClick={() => openLoanModal(p)}
                            className="rounded bg-indigo-600 px-3 py-1.5 text-xs text-white">Express</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tarjetas móvil pendientes */}
          <ul className="sm:hidden divide-y">
            {pendientes.map((p: any) => {
              const multa = multasInputs[p.socioId] ?? Number(p.multa ?? 0);
              const total = (Number(p.montoAporte) + Number(multa)).toFixed(2);
              return (
                <li key={p.socioId} className="py-3 space-y-2">
                  <p className="font-medium text-gray-900">{p.socio.nombres} {p.socio.apellidos}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Multa ($)</p>
                      <input type="number" min="0" step="0.01" value={multa}
                        onChange={e => setMultasInputs(p2 => ({ ...p2, [p.socioId]: Number(e.target.value || 0) }))}
                        className="w-full rounded border px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Total: <strong>${total}</strong></p>
                      <input type="text" value={obsInputs[p.socioId] ?? ""} placeholder="Observaciones"
                        onChange={e => setObsInputs(p2 => ({ ...p2, [p.socioId]: e.target.value }))}
                        className="w-full rounded border px-2 py-1.5 text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button disabled={saving === p.socioId} onClick={() => cobrarPendiente(p.socioId)}
                      className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm text-white font-medium disabled:opacity-50">
                      {saving === p.socioId ? "…" : "Cobrar"}
                    </button>
                    <button onClick={() => openLoanModal(p)}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white font-medium">Express</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Modal Express */}
      {loanOpen && loanSocio && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/30">
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-lg">
            <h4 className="text-base font-semibold mb-1">Préstamo express</h4>
            <p className="text-sm text-gray-600 mb-4">Socio: <strong>{loanSocio.nombres} {loanSocio.apellidos}</strong></p>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-700">Principal</label>
                <input type="number" readOnly value={loanPrincipal} className="mt-1 w-full rounded border px-3 py-2 text-right bg-gray-50 text-sm" />
              </div>
              <div>
                <label className="text-sm text-gray-700">Interés</label>
                <input type="number" min={0} step="0.01" value={loanInteres}
                  onChange={e => setLoanInteres(Number(e.target.value || 0))}
                  className="mt-1 w-full rounded border px-3 py-2 text-right text-sm" />
              </div>
              <div>
                <label className="text-sm text-gray-700">Observaciones</label>
                <input value={loanObs} onChange={e => setLoanObs(e.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm" />
              </div>
              <div className="rounded-md bg-gray-50 px-3 py-2 text-sm">
                Total: <strong>{fmtMoney(loanPrincipal + (loanInteres || 0))}</strong>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setLoanOpen(false)} className="flex-1 rounded-lg border py-2.5 text-sm text-gray-700">Cancelar</button>
              <button onClick={crearPrestamoExpress} disabled={loanSaving}
                className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm text-white font-medium disabled:opacity-50">
                {loanSaving ? "Guardando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
