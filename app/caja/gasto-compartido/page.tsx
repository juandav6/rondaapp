// app/caja/gasto-compartido/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));
const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Socio = { id: number; nombres: string; apellidos: string; numeroCuenta: string; saldoAhorros: number };

export default function GastoCompartidoPage() {
  const [socios, setSocios] = useState<Socio[]>([]);
  const [loadingSocios, setLoadingSocios] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [desc, setDesc] = useState("");
  const [monto, setMonto] = useState("");
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [resultado, setResultado] = useState<{ aplicados: { socioId: number; nombre: string; monto: number }[]; totalSocios: number } | null>(null);

  const showMsg = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4500);
  };

  async function cargarSocios() {
    setLoadingSocios(true);
    setErrorCarga(null);
    try {
      const res = await fetch("/api/socios/gasto-compartido");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      const list: Socio[] = d.socios ?? [];
      setSocios(list);
      setSeleccionados(new Set(list.filter(s => s.saldoAhorros > 0).map(s => s.id)));
    } catch (e: any) {
      setErrorCarga(e.message);
    } finally {
      setLoadingSocios(false);
    }
  }

  useEffect(() => { cargarSocios(); }, []);

  function toggle(id: number) {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function aplicar() {
    setSaving(true);
    setResultado(null);
    try {
      const res = await fetch("/api/socios/gasto-compartido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion: desc.trim(),
          monto: Number(monto),
          socioIds: [...seleccionados],
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setResultado(d);
      showMsg(`Gasto aplicado correctamente a ${d.totalSocios} socios`, true);
      setDesc("");
      setMonto("");
      // Recargar saldos actualizados
      await cargarSocios();
    } catch (e: any) {
      showMsg(e.message, false);
    } finally {
      setSaving(false);
    }
  }

  // Cálculos en tiempo real
  const montoNum = Number(monto) || 0;
  const listaSelec = socios.filter(s => seleccionados.has(s.id));
  const count = listaSelec.length;
  const base = count > 0 && montoNum > 0 ? Math.floor((montoNum / count) * 100) / 100 : 0;
  const residuo = count > 0 && montoNum > 0 ? Math.round((montoNum - base * count) * 100) / 100 : 0;
  const montoPara = (s: Socio) => {
    const idx = listaSelec.indexOf(s);
    if (idx < 0) return 0;
    return idx === listaSelec.length - 1 ? base + residuo : base;
  };
  const hayInsuficientes = listaSelec.some(s => s.saldoAhorros < montoPara(s));

  if (loadingSocios) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-3">
        {[...Array(5)].map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />)}
      </div>
    );
  }

  if (errorCarga) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorCarga}</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Gasto compartido</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Divide un gasto equitativamente entre socios y descuéntalo de sus ahorros.
          Queda registrado como <strong>RETIRO</strong> en el kardex individual.
        </p>
      </div>

      {/* Banner informativo */}
      <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 flex gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-violet-500 shrink-0 mt-0.5">
          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
        </svg>
        <div className="text-xs text-violet-800 space-y-0.5">
          <p className="font-semibold">Esta operación no requiere una ronda activa.</p>
          <p>Puedes registrar gastos compartidos en cualquier momento — por ejemplo: arriendo de sala, materiales, viáticos de reuniones.</p>
        </div>
      </div>

      {/* Formulario */}
      <div className="rounded-xl border bg-white p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-gray-800">Detalles del gasto</h2>

        {msg && (
          <div className={cn(
            "rounded-lg p-3 text-xs font-medium",
            msg.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                   : "bg-red-50 border border-red-200 text-red-700"
          )}>
            {msg.text}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Descripción del gasto *</label>
            <input
              type="text"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Ej: Arriendo sala, café, materiales de reunión…"
              className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Monto total ($) *</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border px-3 py-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
          </div>
        </div>

        {/* Lista de socios — visible cuando hay monto */}
        {montoNum > 0 ? (
          <div className="space-y-3">

            {/* Barra resumen */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-violet-50 border border-violet-200 px-4 py-2.5 text-xs">
              <span className="text-gray-600">
                <strong className="text-violet-800">{count}</strong> de{" "}
                <strong>{socios.filter(s => s.saldoAhorros > 0).length}</strong> socios con saldo seleccionados
              </span>
              <span className="text-gray-300">·</span>
              <span className="text-gray-600">
                Cada uno paga:{" "}
                <strong className="text-violet-800 tabular-nums">{count > 0 ? fmt(base) : "—"}</strong>
                {residuo > 0 && count > 0 && (
                  <span className="text-gray-400"> (último: {fmt(base + residuo)})</span>
                )}
              </span>
              <span className="text-gray-300">·</span>
              <span className="text-gray-600">
                Total:{" "}
                <strong className="tabular-nums">
                  {fmt(base * count + (residuo > 0 ? residuo : 0))}
                </strong>
              </span>
            </div>

            {/* Tabla socios */}
            <div className="rounded-lg border overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_auto_auto] bg-gray-50 border-b px-4 py-2 text-[10px] font-semibold uppercase text-gray-500">
                <span className="w-8" />
                <span>Socio</span>
                <span className="text-right pr-6">Saldo actual</span>
                <span className="text-right w-28">A descontar</span>
              </div>

              <ul className="divide-y">
                {socios.map(s => {
                  const selected = seleccionados.has(s.id);
                  const m = montoPara(s);
                  const suficiente = s.saldoAhorros >= m;
                  return (
                    <li key={s.id}>
                      <label className={cn(
                        "grid grid-cols-[auto_1fr_auto_auto] items-center px-4 py-3 cursor-pointer transition-colors",
                        selected && !suficiente && m > 0 ? "bg-red-50 hover:bg-red-50/80" : "hover:bg-gray-50",
                        s.saldoAhorros <= 0 && !selected ? "opacity-50" : "",
                      )}>
                        <span className="w-8 flex items-center">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggle(s.id)}
                            className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-200"
                          />
                        </span>
                        <span className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 leading-tight">
                            {s.nombres} {s.apellidos}
                          </p>
                          <p className="text-[10px] text-gray-400 font-mono">{s.numeroCuenta}</p>
                        </span>
                        <span className={cn(
                          "text-xs tabular-nums pr-6 text-right",
                          s.saldoAhorros > 0 ? "text-emerald-700 font-semibold" : "text-gray-400"
                        )}>
                          {fmt(s.saldoAhorros)}
                        </span>
                        <span className="w-28 text-right">
                          {selected ? (
                            <span className="space-y-0.5 block">
                              <span className={cn(
                                "text-sm font-bold tabular-nums block",
                                suficiente ? "text-rose-700" : "text-red-600"
                              )}>
                                −{fmt(m)}
                              </span>
                              {!suficiente && (
                                <span className="text-[10px] text-red-500 block leading-none">Saldo insuficiente</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">Excluido</span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Acciones rápidas */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSeleccionados(new Set(socios.filter(s => s.saldoAhorros > 0).map(s => s.id)))}
                className="text-xs text-violet-600 border border-violet-200 rounded-lg px-3 py-1.5 hover:bg-violet-50"
              >
                Seleccionar todos con saldo
              </button>
              <button
                type="button"
                onClick={() => setSeleccionados(new Set())}
                className="text-xs text-gray-500 border rounded-lg px-3 py-1.5 hover:bg-gray-50"
              >
                Limpiar selección
              </button>
            </div>

            {/* Aviso insuficiente + botón confirmar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
              {hayInsuficientes && (
                <p className="text-xs text-red-600">
                  Uno o más socios no tienen saldo suficiente. Deselecta los marcados en rojo.
                </p>
              )}
              <button
                onClick={aplicar}
                disabled={saving || !desc.trim() || montoNum <= 0 || count === 0 || hayInsuficientes}
                className="ml-auto rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-40 transition-colors"
              >
                {saving ? "Aplicando…" : `Confirmar y descontar (${count} socios)`}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-center text-xs text-gray-400 py-3">
            Ingresa la descripción y el monto para ver la distribución entre socios.
          </p>
        )}
      </div>

      {/* Resultado del último gasto aplicado */}
      {resultado && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-emerald-600 shrink-0">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
            </svg>
            <p className="text-sm font-semibold text-emerald-800">
              Gasto aplicado — {resultado.totalSocios} socios
            </p>
          </div>
          <ul className="divide-y divide-emerald-100">
            {resultado.aplicados.map(a => (
              <li key={a.socioId} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-emerald-800">{a.nombre}</span>
                <span className="font-bold text-rose-700 tabular-nums">−{fmt(a.monto)}</span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-emerald-600 mt-3">
            Los movimientos están registrados como RETIRO en el kardex de cada socio.
          </p>
        </div>
      )}
    </div>
  );
}
