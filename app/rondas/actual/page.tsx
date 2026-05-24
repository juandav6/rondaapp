// app/rondas/actual/page.tsx
"use client";
import React, { useEffect, useState } from "react";

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
  sociosParciales?: SocioParcial[];
};
type SocioParcial = {
  socioId: number;
  socio: { nombres: string; apellidos: string; numeroCuenta: string; saldoAhorros: number };
  ahorroSemanaActual: number;
  ahorroRegistradoSemana: boolean;
  totalAcumulado: number;
  objetivo: number;
  ahorroRestante: number;
  historial: { semana: number; monto: number }[];
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
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkMonto, setBulkMonto] = useState<number>(0);
  const [loanOpen, setLoanOpen] = useState(false);
  const [loanSaving, setLoanSaving] = useState(false);
  const [loanSocio, setLoanSocio] = useState<{ id: number; nombres: string; apellidos: string } | null>(null);
  const [loanPrincipal, setLoanPrincipal] = useState(0);
  const [loanInteres, setLoanInteres] = useState(0);
  const [loanObs, setLoanObs] = useState("");

  // Observaciones y detalle de semanas
  const [obsSemana, setObsSemana] = useState("");
  const [savingObs, setSavingObs] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [semanas, setSemanas] = useState<any[]>([]);
  const [loadingSemanas, setLoadingSemanas] = useState(false);
  const [editandoSemana, setEditandoSemana] = useState<number | null>(null);
  const [editObs, setEditObs] = useState("");
  const [showParciales, setShowParciales] = useState(false);
  const [parcialAhorroInputs, setParcialAhorroInputs] = useState<Record<number, number>>({});
  const [bulkParcialMonto, setBulkParcialMonto] = useState<number>(0);
  const [bulkParcialConfirmOpen, setBulkParcialConfirmOpen] = useState(false);
  const [savingParciales, setSavingParciales] = useState(false);
  const [confirmCierreOpen, setConfirmCierreOpen] = useState(false);

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
        body: JSON.stringify({ rondaId: estado.ronda.id, semana: estado.semana, socioId: loanSocio.id, observaciones: loanObs || undefined }),
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
  const prevSemanaRef = React.useRef<string>("");
  useEffect(() => {
    const key = `${estado?.ronda?.id}-${estado?.semana}`;
    if (estado?.items && key !== prevSemanaRef.current) {
      prevSemanaRef.current = key;
      const defaults: Record<number, number> = {};
      estado.items.forEach(it => { defaults[it.socioId] = 1; });
      setAhorroInputs(defaults);
      setMultasInputs({});
      setObsInputs({});
    }
  }, [estado?.semana, estado?.ronda?.id]);
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
      const multa = Number(multasInputs[socioId] ?? 0);
      const res = await fetch(`/api/rondas/${estado.ronda.id}/aportes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socioId, semana: estado.semana, monto: Number(estado.ronda.montoAporte), multa }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || "Error"); }
      // Limpiar multa del socio después de registrar
      setMultasInputs(p => { const n = { ...p }; delete n[socioId]; return n; });
      await cargar();
      showToast(multa > 0 ? `Aporte + multa ${fmtMoney(multa)} registrados` : "Aporte registrado");
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

  async function guardarAhorroTodos() {
    const pendientesAhorro = estado?.items.filter(it => !(it as any).ahorroRegistradoSemana) ?? [];
    if (pendientesAhorro.length === 0) { showToast("Todos ya tienen ahorro registrado esta semana", "info"); setBulkConfirmOpen(false); return; }
    try {
      setCerrando(true);
      setBulkConfirmOpen(false);
      for (const it of pendientesAhorro) {
        const monto = Number(ahorroInputs[it.socioId] ?? 0);
        if (monto <= 0) continue;
        await fetch(`/api/rondas/${estado!.ronda.id}/ahorros`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ socioId: it.socioId, semana: estado!.semana, monto }),
        });
      }
      await cargar();
      showToast("Ahorros registrados para todos");
      setBulkMonto(0);
      const inp = document.getElementById("bulk-ahorro-input") as HTMLInputElement;
      if (inp) inp.value = "";
    } catch (e: any) { showToast(e.message, "error", 4000); }
    finally { setCerrando(false); }
  }

  async function guardarAhorroParcialTodos() {
    const pendientes = estado?.sociosParciales?.filter(sp => !sp.ahorroRegistradoSemana) ?? [];
    if (pendientes.length === 0) { showToast("Todos los socios parciales ya tienen ahorro esta semana", "info"); setBulkParcialConfirmOpen(false); return; }
    try {
      setSavingParciales(true);
      setBulkParcialConfirmOpen(false);
      for (const sp of pendientes) {
        const monto = Number(parcialAhorroInputs[sp.socioId] ?? 0);
        if (monto <= 0) continue;
        await fetch(`/api/rondas/${estado!.ronda.id}/ahorros`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ socioId: sp.socioId, semana: estado!.semana, monto }),
        });
      }
      await cargar();
      showToast("Ahorros registrados para socios parciales");
      setBulkParcialMonto(0);
      setParcialAhorroInputs({});
      const inp = document.getElementById("bulk-parcial-input") as HTMLInputElement;
      if (inp) inp.value = "";
    } catch (e: any) { showToast(e.message, "error", 4000); }
    finally { setSavingParciales(false); }
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

  async function guardarObsSemana() {
    if (!estado) return;
    try {
      setSavingObs(true);
      const res = await fetch(`/api/rondas/${estado.ronda.id}/semanas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semana: estado.semana - 1, observaciones: obsSemana }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || "Error"); }
      showToast("Observación guardada");
    } catch (e: any) { showToast(e.message, "error", 4000); }
    finally { setSavingObs(false); }
  }

  async function cargarSemanas() {
    if (!estado) return;
    setLoadingSemanas(true);
    try {
      const res = await fetch(`/api/rondas/${estado.ronda.id}/semanas`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error");
      setSemanas(data.semanas ?? []);
    } catch { setSemanas([]); }
    finally { setLoadingSemanas(false); }
  }

  async function guardarEditObs(semana: number) {
    if (!estado) return;
    try {
      const res = await fetch(`/api/rondas/${estado.ronda.id}/semanas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semana, observaciones: editObs }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || "Error"); }
      setSemanas(prev => prev.map(s => s.semana === semana ? { ...s, observaciones: editObs } : s));
      setEditandoSemana(null);
      showToast("Observación actualizada");
    } catch (e: any) { showToast(e.message, "error", 4000); }
  }

  async function cerrarSemana() {
    if (!estado) return;
    try {
      setCerrando(true);
      // Guardar observaciones de la semana antes de cerrar
      if (obsSemana.trim()) {
        await fetch(`/api/rondas/${estado.ronda.id}/semanas`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ semana: estado.semana, observaciones: obsSemana }),
        });
      }
      const res = await fetch(`/api/rondas/${estado.ronda.id}/cerrar-semana`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error");
      if (data.avanzada) {
        setAhorroInputs({}); setMultasInputs({}); setObsInputs({}); setObsSemana("");
        if (data.finalizada) window.location.href = `/rondas/${estado.ronda.id}/resultados`;
        else { await cargar(); showToast("Semana cerrada"); }
      } else {
        setPendientes(data.pendientes || []);
        if (data.pendientes?.length) showToast("Quedan pendientes. Usa Préstamo express.", "info", 3500);
      }
    } catch (e: any) { showToast(e.message, "error", 4000); }
    finally { setCerrando(false); }
  }

  // Pre-computar resumen cierre (solo cuando hay estado)
  const cierreTotalAportes    = estado ? estado.items.reduce((s, it) => s + (it.pagado ? Number(estado.ronda.montoAporte) : 0), 0) : 0;
  const cierreTotalAhorros    = estado ? estado.items.reduce((s, it) => s + Number((it as any).ahorroSemana ?? 0), 0) : 0;
  const cierreTotalParciales  = estado ? (estado.sociosParciales ?? []).filter(sp => sp.ahorroRegistradoSemana).reduce((s, sp) => s + sp.ahorroSemanaActual, 0) : 0;
  const cierreSocioQueCobraNombre = estado ? estado.items.find(it => it.orden === estado.semana)?.socio : null;
  const cierreResponsableNombre   = estado ? estado.items.find(it => it.socioId === (estado as any).responsableId)?.socio : null;
  const cierrePendientesAhorro    = estado ? estado.items.filter(it => !(it as any).ahorroRegistradoSemana).length : 0;
  const cierrePendientesParciales = estado ? (estado.sociosParciales ?? []).filter(sp => !sp.ahorroRegistradoSemana).length : 0;

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
  const totalAhorrosSemana = estado.items.reduce((s, it) => s + Number(it.ahorroSemana ?? 0), 0);
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

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <p className="text-sm font-medium text-gray-700">Participantes</p>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {/* Cajón ahorro masivo */}
          <div className="flex items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 shadow-sm">
            <span className="text-xs text-gray-500 whitespace-nowrap">Ahorro a todos:</span>
            <input
              type="number" min="0.01" step="0.01" placeholder="0.00"
              id="bulk-ahorro-input"
              className="w-20 rounded border px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-300"
              onChange={e => {
                const v = Number(e.target.value || 0);
                setBulkMonto(v);
                if (v > 0) {
                  const next: Record<number, number> = {};
                  estado.items.forEach(it => { next[it.socioId] = v; });
                  setAhorroInputs(next);
                }
              }}
            />
            <button
              onClick={() => {
                if (bulkMonto <= 0) { showToast("Ingresa un monto válido", "error"); return; }
                setBulkConfirmOpen(true);
              }}
              disabled={cerrando || bulkMonto <= 0}
              className="rounded bg-blue-600 px-2.5 py-1 text-xs text-white disabled:opacity-50 whitespace-nowrap">
              Guardar todos
            </button>
          </div>
          <button onClick={registrarAporteTodos} disabled={cerrando}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
            {cerrando ? "Registrando…" : "Aporte a todos"}
          </button>
        </div>
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

      {/* Observaciones de semana + Botones */}
      <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-gray-700">Observaciones semana {estado.semana}</p>
          <span className="text-xs text-gray-400">(se guardará al cerrar o manualmente)</span>
        </div>
        <textarea
          rows={3}
          value={obsSemana}
          onChange={e => setObsSemana(e.target.value)}
          placeholder="Anota cualquier novedad de esta semana: inasistencias, acuerdos, cambios de fecha, etc."
          className="w-full rounded-lg border px-3 py-2 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              onClick={guardarObsSemana}
              disabled={savingObs || !obsSemana.trim()}
              className="rounded-lg border px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40">
              {savingObs ? "Guardando…" : "Guardar observación"}
            </button>
            <button
              onClick={() => { setDetalleOpen(true); cargarSemanas(); }}
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 0 1 8.25-8.25.75.75 0 0 1 .75.75v6.75H18a.75.75 0 0 1 .75.75 8.25 8.25 0 0 1-16.5 0Z" clipRule="evenodd"/>
                <path fillRule="evenodd" d="M12.75 3a.75.75 0 0 1 .75-.75 8.25 8.25 0 0 1 8.25 8.25.75.75 0 0 1-.75.75h-7.5a.75.75 0 0 1-.75-.75V3Z" clipRule="evenodd"/>
              </svg>
              Ver detalle semanas
            </button>
          </div>
          <button onClick={() => setConfirmCierreOpen(true)} disabled={cerrando}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            {cerrando ? "Cerrando…" : "Cerrar semana →"}
          </button>
        </div>
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

      {/* ── Socios parciales (solo ahorro, sin aporte de ronda) ── */}
      {(estado.sociosParciales?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-violet-200 bg-white shadow-sm overflow-hidden">
          <button
            onClick={() => setShowParciales(p => !p)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-violet-50/40 transition-colors text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-violet-700 text-xs font-bold">
                {estado.sociosParciales!.length}
              </span>
              <p className="text-sm font-semibold text-violet-900">Socios de ahorro parcial</p>
              {(() => {
                const pendientes = estado.sociosParciales!.filter(sp => !sp.ahorroRegistradoSemana).length;
                const registrados = estado.sociosParciales!.filter(sp => sp.ahorroRegistradoSemana).length;
                return (
                  <div className="flex gap-1.5">
                    {pendientes > 0 && <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-semibold">{pendientes} pendiente{pendientes !== 1 ? "s" : ""}</span>}
                    {registrados > 0 && <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">{registrados} ✓</span>}
                  </div>
                );
              })()}
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
              className={cn("h-4 w-4 text-violet-400 transition-transform shrink-0", showParciales && "rotate-180")}>
              <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd"/>
            </svg>
          </button>

          {showParciales && (
            <>
              {/* Nota explicativa + barra bulk */}
              <div className="border-t border-b bg-violet-50/40 px-4 py-2 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-violet-600">
                  Solo registran ahorro hacia el objetivo de <strong>{fmtMoney(Number(estado.ronda.ahorroObjetivoPorSocio ?? 0))}</strong>.
                </p>
                <div className="flex items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 shadow-sm">
                  <span className="text-xs text-gray-500 whitespace-nowrap">Ahorro a todos:</span>
                  <input
                    type="number" min="0.01" step="0.01" placeholder="0.00"
                    id="bulk-parcial-input"
                    className="w-20 rounded border px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-violet-300"
                    onChange={e => {
                      const v = Number(e.target.value || 0);
                      setBulkParcialMonto(v);
                      if (v > 0) {
                        const next: Record<number, number> = {};
                        estado.sociosParciales!.filter(sp => !sp.ahorroRegistradoSemana).forEach(sp => { next[sp.socioId] = v; });
                        setParcialAhorroInputs(next);
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (bulkParcialMonto <= 0) { showToast("Ingresa un monto válido", "error"); return; }
                      setBulkParcialConfirmOpen(true);
                    }}
                    disabled={savingParciales || bulkParcialMonto <= 0}
                    className="rounded bg-violet-600 px-2.5 py-1 text-xs text-white disabled:opacity-50 whitespace-nowrap">
                    Guardar todos
                  </button>
                </div>
              </div>

              {/* Desktop */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Socio</th>
                      <th className="px-4 py-3 text-right">Sem. {estado.semana}</th>
                      <th className="px-4 py-3 text-right">Acumulado</th>
                      <th className="px-4 py-3 text-right">Objetivo</th>
                      <th className="px-4 py-3 text-right">Restante</th>
                      <th className="px-4 py-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estado.sociosParciales!.map(sp => {
                      const input = parcialAhorroInputs[sp.socioId] ?? 0;
                      const pct = sp.objetivo > 0 ? Math.min((sp.totalAcumulado / sp.objetivo) * 100, 100) : 0;
                      const cumplido = sp.objetivo > 0 && sp.ahorroRestante === 0;
                      return (
                        <tr key={sp.socioId} className={cn(
                          "border-t hover:bg-gray-50/60",
                          sp.ahorroRegistradoSemana && "bg-emerald-50/20",
                          cumplido && "bg-emerald-50/40"
                        )}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{sp.socio.nombres} {sp.socio.apellidos}</p>
                            <p className="text-xs font-mono text-gray-400">{sp.socio.numeroCuenta}</p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {sp.ahorroRegistradoSemana ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                                {fmtMoney(sp.ahorroSemanaActual)}
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd"/></svg>
                              </span>
                            ) : (
                              <input type="number" min="0" step="0.01"
                                value={input || ""}
                                placeholder="0.00"
                                onChange={e => setParcialAhorroInputs(p => ({ ...p, [sp.socioId]: Number(e.target.value) }))}
                                className="w-24 rounded-lg border px-2 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
                            )}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            <div className="flex flex-col items-end gap-1">
                              <span className={cn("font-semibold", cumplido ? "text-emerald-600" : "text-blue-700")}>{fmtMoney(sp.totalAcumulado)}</span>
                              {sp.objetivo > 0 && (
                                <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                                  <div className={cn("h-full rounded-full", cumplido ? "bg-emerald-500" : "bg-violet-400")} style={{ width: `${pct}%` }} />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-500 text-xs">{sp.objetivo > 0 ? fmtMoney(sp.objetivo) : "—"}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            <span className={cn("font-semibold text-sm", cumplido ? "text-emerald-600" : "text-gray-700")}>
                              {cumplido ? "✓ Completo" : sp.objetivo > 0 ? fmtMoney(sp.ahorroRestante) : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {!sp.ahorroRegistradoSemana ? (
                              <button
                                disabled={saving === sp.socioId || !input}
                                onClick={async () => {
                                  if (!input) return;
                                  setSaving(sp.socioId);
                                  try {
                                    const res = await fetch(`/api/rondas/${estado.ronda.id}/ahorros`, {
                                      method: "POST", headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ socioId: sp.socioId, semana: estado.semana, monto: input }),
                                    });
                                    if (!res.ok) throw new Error((await res.json()).error);
                                    showToast(`Ahorro registrado — ${sp.socio.nombres}`, "success");
                                    setParcialAhorroInputs(p => ({ ...p, [sp.socioId]: 0 }));
                                    await cargar();
                                  } catch (e: any) { showToast(e.message, "error"); }
                                  finally { setSaving(null); }
                                }}
                                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed">
                                {saving === sp.socioId ? "…" : "Guardar"}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Registrado</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-violet-100 bg-violet-50/30">
                    <tr>
                      <td className="px-4 py-2 text-xs font-semibold text-violet-700">
                        Total {estado.sociosParciales!.filter(sp => sp.ahorroRegistradoSemana).length}/{estado.sociosParciales!.length} registrados
                      </td>
                      <td className="px-4 py-2 text-right text-xs font-semibold text-emerald-700">
                        {fmtMoney(estado.sociosParciales!.filter(sp => sp.ahorroRegistradoSemana).reduce((s, sp) => s + sp.ahorroSemanaActual, 0))}
                      </td>
                      <td className="px-4 py-2 text-right text-xs font-semibold text-blue-700">
                        {fmtMoney(estado.sociosParciales!.reduce((s, sp) => s + sp.totalAcumulado, 0))}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Móvil */}
              <ul className="sm:hidden divide-y">
                {estado.sociosParciales!.map(sp => {
                  const input = parcialAhorroInputs[sp.socioId] ?? 0;
                  const pct = sp.objetivo > 0 ? Math.min((sp.totalAcumulado / sp.objetivo) * 100, 100) : 0;
                  const cumplido = sp.objetivo > 0 && sp.ahorroRestante === 0;
                  return (
                    <li key={sp.socioId} className={cn("p-4 space-y-2.5", sp.ahorroRegistradoSemana && "bg-emerald-50/20")}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{sp.socio.nombres} {sp.socio.apellidos}</p>
                          <p className="text-xs font-mono text-gray-400">{sp.socio.numeroCuenta}</p>
                        </div>
                        {sp.ahorroRegistradoSemana && (
                          <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-semibold shrink-0">
                            ✓ {fmtMoney(sp.ahorroSemanaActual)}
                          </span>
                        )}
                        {cumplido && !sp.ahorroRegistradoSemana && (
                          <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-semibold shrink-0">✓ Objetivo</span>
                        )}
                      </div>
                      {sp.objetivo > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Progreso</span>
                            <span className={cn("font-medium", cumplido ? "text-emerald-600" : "text-blue-700")}>
                              {fmtMoney(sp.totalAcumulado)} / {fmtMoney(sp.objetivo)}
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                            <div className={cn("h-full rounded-full", cumplido ? "bg-emerald-500" : "bg-violet-400")} style={{ width: `${pct}%` }} />
                          </div>
                          {!cumplido && <p className="text-xs text-gray-400">Faltan {fmtMoney(sp.ahorroRestante)}</p>}
                        </div>
                      )}
                      {!sp.ahorroRegistradoSemana && (
                        <div className="flex gap-2">
                          <input type="number" min="0" step="0.01" value={input || ""}
                            onChange={e => setParcialAhorroInputs(p => ({ ...p, [sp.socioId]: Number(e.target.value) }))}
                            className="flex-1 rounded-lg border px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-violet-200"
                            placeholder={`Ahorro sem. ${estado.semana}`} />
                          <button
                            disabled={saving === sp.socioId || !input}
                            onClick={async () => {
                              if (!input) return;
                              setSaving(sp.socioId);
                              try {
                                const res = await fetch(`/api/rondas/${estado.ronda.id}/ahorros`, {
                                  method: "POST", headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ socioId: sp.socioId, semana: estado.semana, monto: input }),
                                });
                                if (!res.ok) throw new Error((await res.json()).error);
                                showToast(`Ahorro registrado`, "success");
                                setParcialAhorroInputs(p => ({ ...p, [sp.socioId]: 0 }));
                                await cargar();
                              } catch (e: any) { showToast(e.message, "error"); }
                              finally { setSaving(null); }
                            }}
                            className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white disabled:opacity-40">
                            {saving === sp.socioId ? "…" : "Guardar"}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Modal Express */}
      {loanOpen && loanSocio && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/30">
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-lg">
            <h4 className="text-base font-semibold mb-1">Préstamo express</h4>
            <p className="text-sm text-gray-500 mb-4">Socio: <strong className="text-gray-900">{loanSocio.nombres} {loanSocio.apellidos}</strong></p>
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4 mb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Principal</span>
                <span className="font-semibold">{fmtMoney(loanPrincipal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Interés semana {estado.semana + 1}</span>
                <span className="font-semibold text-indigo-700">$1.00</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold">Total a cobrar sem. {estado.semana + 1}</span>
                <span className="font-bold text-indigo-700">{fmtMoney(loanPrincipal + 1)}</span>
              </div>
              <p className="text-[11px] text-gray-400 pt-1">Si no paga en la semana {estado.semana + 1}, el interés aumenta $1 automáticamente cada semana.</p>
            </div>
            <div>
              <label className="text-sm text-gray-700 mb-1 block">Observaciones</label>
              <input value={loanObs} onChange={e => setLoanObs(e.target.value)}
                placeholder="Motivo del préstamo (opcional)"
                className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setLoanOpen(false)} className="flex-1 rounded-lg border py-2.5 text-sm text-gray-700">Cancelar</button>
              <button onClick={crearPrestamoExpress} disabled={loanSaving}
                className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm text-white font-medium disabled:opacity-50">
                {loanSaving ? "Guardando…" : "Confirmar express"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal confirmación ahorro masivo */}
      {bulkConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30">
          <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd"/>
                </svg>
              </span>
              <div>
                <h4 className="text-base font-semibold text-gray-900">Confirmar registro masivo</h4>
                <p className="text-sm text-gray-500 mt-1">
                  ¿Estás seguro de registrar un ahorro de{" "}
                  <strong className="text-blue-700">{fmtMoney(bulkMonto)}</strong>{" "}
                  para{" "}
                  <strong>{estado?.items.filter(it => !(it as any).ahorroRegistradoSemana).length ?? 0} socios</strong>{" "}
                  en la semana <strong>{estado?.semana}</strong>?
                </p>
                <p className="text-xs text-gray-400 mt-1.5">
                  Total: <strong className="text-gray-700">{fmtMoney(bulkMonto * (estado?.items.filter(it => !(it as any).ahorroRegistradoSemana).length ?? 0))}</strong>
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setBulkConfirmOpen(false)}
                className="flex-1 rounded-lg border py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={guardarAhorroTodos}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                Sí, registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal resumen antes de cerrar semana ── */}
      {confirmCierreOpen && estado && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-emerald-600 px-5 py-4">
              <h3 className="text-base font-bold text-white">Resumen semana {estado.semana}</h3>
              <p className="text-xs text-emerald-100 mt-0.5">{estado.ronda.nombre} · Revisa antes de cerrar</p>
            </div>

            {/* Cuerpo */}
            <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">

              {/* Cobro de ronda */}
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Cobro de ronda</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white border p-2.5">
                    <p className="text-[10px] text-gray-400 uppercase">Total aportes</p>
                    <p className="text-lg font-bold text-blue-700 tabular-nums">{fmtMoney(cierreTotalAportes)}</p>
                    <p className="text-[10px] text-gray-400">{estado.items.filter(it => it.pagado).length}/{estado.items.length} pagaron</p>
                  </div>
                  <div className="rounded-lg bg-white border p-2.5">
                    <p className="text-[10px] text-gray-400 uppercase">Multas cobradas</p>
                    <p className="text-lg font-bold text-red-600 tabular-nums">
                      {fmtMoney(estado.items.reduce((s, it) => s + Number((it as any).multa ?? 0), 0))}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-white border p-2 space-y-0.5">
                    <p className="text-gray-400">Socio que cobra</p>
                    <p className="font-semibold text-gray-800">
                      {cierreSocioQueCobraNombre
                        ? `${cierreSocioQueCobraNombre.nombres} ${cierreSocioQueCobraNombre.apellidos}`
                        : <span className="italic text-gray-400">Sin asignar</span>}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white border p-2 space-y-0.5">
                    <p className="text-gray-400">Responsable cobro</p>
                    <p className="font-semibold text-gray-800">
                      {cierreResponsableNombre
                        ? `${cierreResponsableNombre.nombres} ${cierreResponsableNombre.apellidos}`
                        : <span className="italic text-gray-400">Sin asignar</span>}
                    </p>
                  </div>
                </div>
              </div>

              {/* Ahorros */}
              <div className="rounded-xl bg-teal-50 border border-teal-100 p-3 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Ahorros semana {estado.semana}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white border p-2.5">
                    <p className="text-[10px] text-gray-400 uppercase">Socios participantes</p>
                    <p className="text-lg font-bold text-teal-700 tabular-nums">{fmtMoney(cierreTotalAhorros)}</p>
                    {cierrePendientesAhorro > 0 && (
                      <p className="text-[10px] text-amber-600 font-medium">{cierrePendientesAhorro} sin registrar</p>
                    )}
                  </div>
                  <div className="rounded-lg bg-white border p-2.5">
                    <p className="text-[10px] text-gray-400 uppercase">Socios parciales</p>
                    <p className="text-lg font-bold text-violet-700 tabular-nums">{fmtMoney(cierreTotalParciales)}</p>
                    {cierrePendientesParciales > 0 && (
                      <p className="text-[10px] text-amber-600 font-medium">{cierrePendientesParciales} sin registrar</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Express pendientes */}
              {pendientes.length > 0 && (
                <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-indigo-700 mb-2">
                    Préstamos express ({pendientes.length})
                  </p>
                  <div className="space-y-1">
                    {pendientes.map((p: any) => (
                      <div key={p.socioId} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{p.socio?.nombres} {p.socio?.apellidos}</span>
                        <span className="font-semibold text-indigo-700">{fmtMoney(p.montoAporte)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Observaciones */}
              <div className="rounded-xl bg-gray-50 border p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Observaciones</p>
                {obsSemana.trim()
                  ? <p className="text-sm text-gray-700 whitespace-pre-wrap">{obsSemana}</p>
                  : <p className="text-xs text-gray-400 italic">Sin observaciones registradas para esta semana</p>}
              </div>

              {/* Alertas pendientes */}
              {(cierrePendientesAhorro > 0 || cierrePendientesParciales > 0) && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700 space-y-1">
                  <p className="font-semibold">⚠️ Quedan registros sin completar:</p>
                  {cierrePendientesAhorro > 0 && (
                    <p>• {cierrePendientesAhorro} socio{cierrePendientesAhorro > 1 ? "s" : ""} participante{cierrePendientesAhorro > 1 ? "s" : ""} sin ahorro</p>
                  )}
                  {cierrePendientesParciales > 0 && (
                    <p>• {cierrePendientesParciales} socio{cierrePendientesParciales > 1 ? "s" : ""} parcial{cierrePendientesParciales > 1 ? "es" : ""} sin ahorro</p>
                  )}
                  <p className="text-amber-500 italic">Puedes cerrar igual — quedarán como no registrados.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t px-5 py-4 flex gap-3 bg-gray-50">
              <button
                onClick={() => setConfirmCierreOpen(false)}
                className="flex-1 rounded-xl border bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Revisar más
              </button>
              <button
                onClick={() => { setConfirmCierreOpen(false); cerrarSemana(); }}
                disabled={cerrando}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {cerrando ? "Cerrando…" : "Confirmar cierre →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación ahorro masivo parciales */}
      {bulkParcialConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30">
          <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd"/>
                </svg>
              </span>
              <div>
                <h4 className="text-base font-semibold text-gray-900">Confirmar ahorro masivo</h4>
                <p className="text-sm text-gray-500 mt-1">
                  ¿Registrar{" "}
                  <strong className="text-violet-700">{fmtMoney(bulkParcialMonto)}</strong>{" "}
                  de ahorro para{" "}
                  <strong>{estado?.sociosParciales?.filter(sp => !sp.ahorroRegistradoSemana).length ?? 0} socios parciales</strong>{" "}
                  en la semana <strong>{estado?.semana}</strong>?
                </p>
                <p className="text-xs text-gray-400 mt-1.5">
                  Total: <strong className="text-gray-700">
                    {fmtMoney(bulkParcialMonto * (estado?.sociosParciales?.filter(sp => !sp.ahorroRegistradoSemana).length ?? 0))}
                  </strong>
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setBulkParcialConfirmOpen(false)}
                className="flex-1 rounded-lg border py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={guardarAhorroParcialTodos}
                className="flex-1 rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
                Sí, registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle semanas */}
      {detalleOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30">
          <div className="relative z-50 w-full sm:max-w-3xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div>
                <h3 className="text-base font-bold text-gray-900">Detalle de semanas · {estado?.ronda.nombre}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{semanas.length} semana{semanas.length !== 1 ? "s" : ""} cerrada{semanas.length !== 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => { setDetalleOpen(false); setEditandoSemana(null); }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {loadingSemanas ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />)}
                </div>
              ) : semanas.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">Aún no hay semanas cerradas.</div>
              ) : semanas.map(s => (
                <div key={s.semana} className="rounded-xl border bg-white p-4 space-y-3">
                  {/* Header semana */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                        {s.semana}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Semana {s.semana}</p>
                        {s.responsableNombre && (
                          <p className="text-xs text-gray-400">Responsable: {s.responsableNombre}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => { setEditandoSemana(s.semana); setEditObs(s.observaciones ?? ""); }}
                      className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50 shrink-0">
                      Editar obs.
                    </button>
                  </div>

                  {/* KPIs semana */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="rounded-lg bg-gray-50 p-2">
                      <p className="text-gray-400">Aportes</p>
                      <p className="font-bold text-gray-800 tabular-nums">{fmtMoney(s.totalAportes)}</p>
                      <p className="text-gray-400">{s.sociosPagaron}/{s.totalSocios} socios</p>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-2">
                      <p className="text-blue-400">Ahorros</p>
                      <p className="font-bold text-blue-700 tabular-nums">{fmtMoney(s.totalAhorros)}</p>
                    </div>
                    <div className="rounded-lg bg-red-50 p-2">
                      <p className="text-red-400">Multas</p>
                      <p className="font-bold text-red-600 tabular-nums">{fmtMoney(s.totalMultas)}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-2">
                      <p className="text-emerald-500">Cobra</p>
                      <p className="font-semibold text-emerald-700 truncate">{s.receptor?.nombre ?? "—"}</p>
                    </div>
                  </div>

                  {/* Observaciones */}
                  {editandoSemana === s.semana ? (
                    <div className="space-y-2">
                      <textarea
                        rows={3}
                        value={editObs}
                        onChange={e => setEditObs(e.target.value)}
                        placeholder="Observaciones de la semana…"
                        className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setEditandoSemana(null)}
                          className="flex-1 rounded-lg border py-2 text-xs text-gray-600 hover:bg-gray-50">
                          Cancelar
                        </button>
                        <button onClick={() => guardarEditObs(s.semana)}
                          className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={cn(
                      "rounded-lg px-3 py-2 text-xs",
                      s.observaciones ? "bg-amber-50 border border-amber-100 text-amber-800" : "bg-gray-50 text-gray-400 italic"
                    )}>
                      {s.observaciones || "Sin observaciones"}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t px-5 py-3 shrink-0 flex justify-end">
              <button onClick={() => { setDetalleOpen(false); setEditandoSemana(null); }}
                className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
