import "./globals.css"
import type { Metadata } from "next"
import ClientShell from "./client-shell"

export const metadata: Metadata = {
  title: "Tebas Tech",
  description: "Sistema de gestão para pequenos comércios",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="h-screen">
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  )
}
