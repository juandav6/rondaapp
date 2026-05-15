// app/reportes/config/page.tsx
"use client";
import { useEffect, useState } from "react";

type Config = {
  emailAdmin: string;
  emailsExtra: string;
  envioActivo: boolean;
};

export default function ReportesConfigPage() {
  const [config, setConfig] = useState<Config>({ emailAdmin: "", emailsExtra: "", envioActivo: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reportes/config")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setConfig(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true); setError(null); setSuccess(null);
      const res = await fetch("/api/reportes/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Error al guardar");
      setSuccess("Configuración guardada correctamente");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function enviarAhora() {
    try {
      setSending(true); setError(null); setSuccess(null);
      const res = await fetch("/api/reportes/enviar", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error al enviar");
      setSuccess(`✅ Reporte enviado a: ${data.destinatarios?.join(", ")}`);
    } catch (e: any) { setError(e.message); }
    finally { setSending(false); }
  }

  if (loading) return (
    <div className="p-4 space-y-3">
      {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />)}
    </div>
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67Z"/>
              <path d="M22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z"/>
            </svg>
          </span>
          <div>
            <h1 className="text-lg sm:text-2xl font-semibold tracking-tight">Reportes por correo</h1>
            <p className="text-xs sm:text-sm text-gray-500">Configura el envío automático mensual con Excel y PDF adjuntos</p>
          </div>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Formulario config */}
        <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Configuración del envío</h2>
          <form onSubmit={guardar} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Correo principal del administrador <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={config.emailAdmin}
                onChange={e => setConfig(c => ({ ...c, emailAdmin: e.target.value }))}
                placeholder="admin@ejemplo.com"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
              />
              <p className="mt-1 text-xs text-gray-400">Recibirá el reporte mensual con Excel y PDF adjuntos</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Correos adicionales
              </label>
              <textarea
                value={config.emailsExtra}
                onChange={e => setConfig(c => ({ ...c, emailsExtra: e.target.value }))}
                placeholder="otro@ejemplo.com, tercero@ejemplo.com"
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200 resize-none"
              />
              <p className="mt-1 text-xs text-gray-400">Separados por coma. Ej: tesorero@empresa.com, directora@empresa.com</p>
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setConfig(c => ({ ...c, envioActivo: !c.envioActivo }))}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${config.envioActivo ? "bg-blue-600" : "bg-gray-200"}`}>
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${config.envioActivo ? "translate-x-4" : "translate-x-0"}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Envío automático mensual</p>
                  <p className="text-xs text-gray-400">Se envía automáticamente el último día de cada mes</p>
                </div>
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white ${saving ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}>
              {saving ? "Guardando…" : "Guardar configuración"}
            </button>
          </form>
        </div>

        {/* Panel envío manual */}
        <div className="space-y-4">
          {/* Enviar ahora */}
          <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-2">Enviar reporte ahora</h2>
            <p className="text-sm text-gray-500 mb-4">
              Genera y envía inmediatamente el reporte de la ronda activa con los datos actuales.
              Se adjuntarán el archivo Excel y el PDF.
            </p>
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 mb-4 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">El reporte incluye:</p>
              <p>📊 Excel — participantes, aportes, ahorros, préstamos, fondo de inversión</p>
              <p>📄 PDF — resumen ejecutivo con KPIs y tablas detalladas</p>
              <p>📧 Email HTML — resumen visual con los datos principales</p>
            </div>
            <button
              onClick={enviarAhora}
              disabled={sending || !config.emailAdmin}
              className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white flex items-center justify-center gap-2 ${
                sending || !config.emailAdmin
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}>
              {sending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/>
                    <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4"/>
                  </svg>
                  Generando y enviando…
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405Z"/>
                  </svg>
                  Enviar reporte ahora
                </>
              )}
            </button>
            {!config.emailAdmin && (
              <p className="mt-2 text-xs text-center text-gray-400">Configura un correo antes de enviar</p>
            )}
          </div>

          {/* Info cron */}
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">📅 Programación automática</h3>
            <p className="text-xs text-gray-500 mb-2">
              El sistema envía el reporte automáticamente el <strong>último día de cada mes</strong> a las 9:00 AM (UTC).
            </p>
            <p className="text-xs text-gray-400">
              Requiere agregar en <code className="bg-white border rounded px-1 py-0.5">vercel.json</code>:
            </p>
            <pre className="mt-2 rounded-lg bg-gray-900 text-green-400 text-[10px] p-3 overflow-x-auto">
{`{
  "crons": [{
    "path": "/api/reportes/enviar",
    "schedule": "0 9 28-31 * *"
  }]
}`}
            </pre>
            <p className="mt-2 text-xs text-gray-400">
              También agrega <code className="bg-white border rounded px-1 py-0.5">CRON_SECRET</code> en las variables de entorno de Vercel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
