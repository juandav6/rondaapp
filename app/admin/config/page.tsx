// app/admin/config/page.tsx
"use client";
import { useEffect, useState } from "react";

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n||0));
const cn = (...c: (string|false|null|undefined)[]) => c.filter(Boolean).join(" ");

export default function AdminConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{text:string;ok:boolean}|null>(null);

  const [emailAdmin, setEmailAdmin] = useState("");
  const [emailsExtra, setEmailsExtra] = useState("");
  const [envioActivo, setEnvioActivo] = useState(true);

  const showMsg = (text:string, ok:boolean) => { setMsg({text,ok}); setTimeout(()=>setMsg(null),5000); };

  async function cargar() {
    try {
      const r = await fetch("/api/admin/config");
      if (!r.ok) {
        // Fallback: intentar la ruta de reportes
        const r2 = await fetch("/api/reportes/config");
        if (!r2.ok) throw new Error("No se pudo cargar la configuracion");
        const d = await r2.json();
        setEmailAdmin(d.emailAdmin ?? "");
        setEmailsExtra(d.emailsExtra ?? "");
        setEnvioActivo(d.envioActivo ?? true);
        return;
      }
      const d = await r.json();
      setEmailAdmin(d.emailAdmin ?? "");
      setEmailsExtra(d.emailsExtra ?? "");
      setEnvioActivo(d.envioActivo ?? true);
    } catch (e:any) { showMsg(e.message, false); }
    finally { setLoading(false); }
  }

  useEffect(() => { cargar(); }, []);

  async function guardar() {
    setSaving(true);
    try {
      // Intentar primero /api/admin/config, fallback a /api/reportes/config
      let res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailAdmin, emailsExtra, envioActivo }),
      });
      if (!res.ok && res.status === 404) {
        res = await fetch("/api/reportes/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emailAdmin, emailsExtra, envioActivo }),
        });
      }
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Error al guardar");
      showMsg("Configuracion guardada correctamente", true);
    } catch (e:any) { showMsg(e.message, false); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-4 space-y-2">{[...Array(3)].map((_,i)=><div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100"/>)}</div>;

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Configuracion de reportes</h1>
        <p className="text-xs text-gray-400">Administra los emails y opciones de envio de reportes</p>
      </div>

      {msg && <div className={cn("rounded-xl p-3 text-sm", msg.ok?"bg-emerald-50 border border-emerald-200 text-emerald-700":"bg-red-50 border border-red-200 text-red-700")}>{msg.text}</div>}

      <div className="rounded-xl border bg-white shadow-sm p-4 sm:p-5 w-full max-w-lg">
        <div className="space-y-4">
          {/* Email Admin */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Email del administrador</label>
            <input type="email" value={emailAdmin} onChange={e => setEmailAdmin(e.target.value)}
              placeholder="admin@ejemplo.com"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"/>
            <p className="mt-1 text-[11px] text-gray-400">Email principal que recibe los reportes</p>
          </div>

          {/* Emails Extra */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Emails adicionales</label>
            <textarea value={emailsExtra} onChange={e => setEmailsExtra(e.target.value)}
              rows={3}
              placeholder="email1@ejemplo.com, email2@ejemplo.com"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 resize-none"/>
            <p className="mt-1 text-[11px] text-gray-400">Separados por comas. Estos emails tambien recibiran los reportes</p>
          </div>

          {/* Envio Activo */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium text-gray-900">Envio activo</p>
              <p className="text-[11px] text-gray-400">Habilitar o deshabilitar el envio automatico de reportes</p>
            </div>
            <button
              onClick={() => setEnvioActivo(!envioActivo)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                envioActivo ? "bg-emerald-600" : "bg-gray-300"
              )}
            >
              <span className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                envioActivo ? "translate-x-6" : "translate-x-1"
              )} />
            </button>
          </div>

          {!envioActivo && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
              El envio de reportes esta desactivado. No se enviaran emails automaticamente al cerrar semanas.
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-2">
          <button onClick={cargar} disabled={saving}
            className="rounded-lg border px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
            Recargar
          </button>
          <button onClick={guardar} disabled={saving}
            className="flex-1 rounded-lg bg-violet-600 py-2.5 text-sm text-white disabled:opacity-50 hover:bg-violet-700">
            {saving ? "Guardando..." : "Guardar configuracion"}
          </button>
        </div>
      </div>
    </div>
  );
}
