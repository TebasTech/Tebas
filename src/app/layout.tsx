import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Tebas Tech",
  description: "Sistema de gestão para pequenos comércios",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="h-screen">{children}</body>
    </html>
  )
}
