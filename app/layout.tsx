// app/layout.tsx  (Server Component)
import type { Metadata } from "next";
import "./globals.css";

import DefaultLayout from "@/layout/DefaultLayout"; // TU layout de UI (cliente)
import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";

export const metadata: Metadata = {
  title: "Tu App",
  description: "Caja de ahorros",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="bg-gray-100 dark:bg-gray-900">
        {/* Providers arriba, sin hooks aquí */}
        <ThemeProvider>
          <SidebarProvider>
            <DefaultLayout>{children}</DefaultLayout>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
