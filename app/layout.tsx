// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import DefaultLayout from "@/layout/DefaultLayout";
import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "MiRonda",
  description: "Sistema de gestión de rondas de ahorro",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="bg-gray-100 dark:bg-gray-900">
        <Providers>
          <ThemeProvider>
            <SidebarProvider>
              <DefaultLayout>{children}</DefaultLayout>
            </SidebarProvider>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
