// app/admin/secuencias/page.tsx
"use client";
import { useEffect, useState } from "react";

const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Secuencia = {
  key: string;
  nombre: string;
  prefijo: string;
  padding: number;
  descripcion: string;
  valorActual: number;
  proximoValor: number;
  proximoCodigo: string;
  ultimoExistente: string;
};

export default function AdminSecuenciasPage() {
  const [secuencias, setSecuencias] = useState<Secuencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Secuencia | null>(null);
  const [nuevoValor, setNuevoValor] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const showMsg = (text: string, ok: boolean) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 5000); };

  async function cargar() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/secuencias", { cache: "no-store" });
      const d = await res.json();
      setSecuencias(Array.isArray(d) ? d : []);
    } catch (e: any) { showMsg(e.message, false); }
    finally { setLoading(false); }
  }

  useEffect(() => { cargar(); }, []);

  async function guardar() {
    if (!editando) return;
    const n = Number(nuevoValor);
    if (!Number.isFinite(n) || n < 1) { showMsg("El valor debe ser un número entero mayor a 0", false); return; }

    const codigoNuevo = `${editando.prefijo}${String(n).padStart(editando.padding, "0")}`;
    if (!confirm(
      `¿Confirmar cambio de secuencia?\n\n` +
      `Secuencia: ${editando.nombre}\n` +
      `Próximo código actual: ${editando.proximoCodigo}\n` +
      `Próximo código nuevo: ${codigoNuevo}\n\n` +
      `⚠️ El siguiente registro creado usará el código ${codigoNuevo}.\n` +
      `Asegúrate de que no exista ya un registro con ese código.\n\n` +
      `Quedará registrado en bitácora.`
    )) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/secuencias", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: editando.key, nuevoValor: n }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg(d.mensaje, true);
      setEditando(null);
      setNuevoValor("");
      await cargar();
    } catch (e: any) { showMsg(e.message, false); }
    finally { setSaving(false); }
  }

  const ICONOS: Record<string, string> = {
    numero_cuenta_seq: "👤",
    ronda_codigo_seq: "📅",
  };

  const COLORES: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    numero_cuenta_seq: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", badge: "bg-violet-100 text-violet-700" },
    ronda_codigo_seq: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", badge: "bg-blue-100 text-blue-700" },
  };

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Control de secuencias</h1>
        <p className="text-xs text-gray-400">Forzar el próximo número de cuenta o código de ronda</p>
      </div>

      {msg && (
        <div className={cn("rounded-xl p-3 text-sm", msg.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700")}>
          {msg.text}
        </div>
      )}

      {/* Info */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <div className="flex gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0 text-amber-500 mt-0.5">
            <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd"/>
          </svg>
          <div>
            <p className="font-semibold mb-1">¿Para qué sirve esto?</p>
            <p>Si eliminaste una ronda o socio y quieres que el siguiente registro use un número específico (por ejemplo, que la próxima ronda sea RD0005 en vez de RD0007), usa esta pantalla para ajustar la secuencia.</p>
            <p className="mt-1">El cambio aplica <strong>al próximo registro creado</strong>. No modifica registros existentes.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-100"/>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {secuencias.map(seq => {
            const col = COLORES[seq.key] ?? COLORES.ronda_codigo_seq;
            return (
              <div key={seq.key} className={cn("rounded-xl border p-4 shadow-sm", col.bg, col.border)}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{ICONOS[seq.key]}</span>
                    <div>
                      <p className={cn("font-semibold text-sm", col.text)}>{seq.nombre}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{seq.descripcion}</p>
                    </div>
                  </div>
                </div>

                {/* Valores */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="rounded-lg bg-white border px-3 py-2">
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Último registrado</p>
                    <p className="text-sm font-bold text-gray-700 font-mono mt-0.5">{seq.ultimoExistente}</p>
                  </div>
                  <div className={cn("rounded-lg border px-3 py-2", col.bg, col.border)}>
                    <p className={cn("text-[10px] uppercase font-semibold", col.text)}>Próximo a generar</p>
                    <p className={cn("text-sm font-bold font-mono mt-0.5", col.text)}>{seq.proximoCodigo}</p>
                  </div>
                </div>

                <button
                  onClick={() => { setEditando(seq); setNuevoValor(String(seq.proximoValor)); }}
                  className={cn("w-full rounded-lg px-3 py-2 text-sm font-medium border transition-colors", col.text, col.border, "bg-white hover:brightness-95")}>
                  Cambiar próximo número
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Historial rápido */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-gray-700 mb-1">Ejemplos de uso</p>
        <ul className="space-y-1.5 text-xs text-gray-500">
          <li className="flex gap-2">
            <span className="text-blue-500">→</span>
            <span><strong>Eliminaste RD0005</strong> y quieres que la próxima ronda sea RD0005 de nuevo: pon <span className="font-mono bg-gray-100 px-1 rounded">5</span> en la secuencia de rondas.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-violet-500">→</span>
            <span><strong>Quieres que el próximo socio sea CTA1030</strong>: pon <span className="font-mono bg-gray-100 px-1 rounded">1030</span> en la secuencia de cuentas.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-500">⚠️</span>
            <span>No pongas un número que ya esté en uso — causará error de duplicado al crear el registro.</span>
          </li>
        </ul>
      </div>

      {/* Modal */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold mb-1">Cambiar secuencia</h3>
            <p className="text-xs text-gray-400 mb-4">{editando.nombre}</p>

            <div className="rounded-lg bg-gray-50 border p-3 mb-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Último registrado:</span>
                <span className="font-mono font-semibold">{editando.ultimoExistente}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Próximo actual:</span>
                <span className="font-mono font-semibold">{editando.proximoCodigo}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="text-gray-500">Próximo nuevo:</span>
                <span className="font-mono font-bold text-blue-700">
                  {nuevoValor && Number(nuevoValor) > 0
                    ? `${editando.prefijo}${String(Number(nuevoValor)).padStart(editando.padding, "0")}`
                    : "—"}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Próximo número *
              </label>
              <input
                type="number" min="1" step="1"
                value={nuevoValor}
                onChange={e => setNuevoValor(e.target.value)}
                placeholder="Ej: 5"
                className="w-full rounded-lg border px-3 py-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-200"
                autoFocus
              />
              <p className="mt-1 text-xs text-gray-400">
                El siguiente registro creado usará el código{" "}
                <strong className="text-blue-700">
                  {nuevoValor && Number(nuevoValor) > 0
                    ? `${editando.prefijo}${String(Number(nuevoValor)).padStart(editando.padding, "0")}`
                    : "—"}
                </strong>
              </p>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mt-3 text-xs text-amber-700">
              ⚠️ Asegúrate de que el código nuevo no exista ya en la base de datos. Quedará en bitácora.
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={() => { setEditando(null); setNuevoValor(""); }}
                className="flex-1 rounded-lg border py-2.5 text-sm text-gray-700">Cancelar</button>
              <button onClick={guardar} disabled={saving || !nuevoValor || Number(nuevoValor) < 1}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm text-white disabled:opacity-50">
                {saving ? "Aplicando…" : "Aplicar cambio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
