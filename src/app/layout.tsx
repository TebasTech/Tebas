import "./globals.css"
import type { Metadata } from "next"
import Link from "next/link"
import { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Tebas Tech",
  description: "Sistema de gestão para pequenos comércios",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="h-screen">
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Topbar />
            <main className="flex-1 overflow-auto bg-[rgb(var(--tebas-bg))] p-6">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  )
}

function Sidebar() {
  return (
    <aside className="w-[280px] bg-[rgb(var(--tebas-sidebar))] text-white flex flex-col">
      {/* Logo / brand */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="text-lg font-semibold leading-tight">Tebas Tech</div>
        <div className="text-xs opacity-70">Gestão simples. Lucro claro.</div>
      </div>

      {/* Menu */}
      <nav className="flex-1 px-3 py-4 space-y-1 text-[14px]">
        <NavItem href="/" label="Visão Geral" icon={<IconGrid />} />
        <NavItem href="/loja" label="Loja" icon={<IconStore />} />
        <NavItem href="/estoque" label="Estoque" icon={<IconBoxes />} />
        <NavItem href="/produtos" label="Produtos" icon={<IconTag />} />
        <NavItem href="/clientes" label="Clientes" icon={<IconUser />} />
        <NavItem href="/vendas" label="Vendas" icon={<IconCart />} />
        <NavItem href="/financeiro" label="Compras & Despesas" icon={<IconWallet />} />
        <NavItem href="/marketing" label="Marketing" icon={<IconMegaphone />} />
        <NavItem href="/estatisticas" label="Estatísticas" icon={<IconChart />} />
        <NavItem href="/ajuda" label="Ajuda" icon={<IconHelp />} />
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/10 text-xs opacity-70">
        Tebas Tech • v0.1
      </div>
    </aside>
  )
}

function Topbar() {
  return (
    <header className="h-16 bg-white border-b border-black/5 flex items-center justify-between px-6">
      <div className="flex items-center gap-3 w-full max-w-xl">
        <div className="relative w-full">
          <input
            placeholder="Buscar… (produto, cliente, venda)"
            className="w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-4 pr-10 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50">
            <IconSearch />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="h-10 px-4 rounded-lg bg-[rgb(var(--tebas-primary))] text-white text-sm font-medium hover:opacity-90">
          + Produto
        </button>

        <div className="flex items-center gap-2 pl-2">
          <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-700">
            TT
          </div>
          <div className="text-sm text-slate-700">Conta</div>
        </div>
      </div>
    </header>
  )
}

function NavItem({
  href,
  label,
  icon,
}: {
  href: string
  label: string
  icon: ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-4 py-3 text-white/90 hover:bg-white/10 transition"
    >
      <span className="opacity-90">{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  )
}

/* ----- Inline icons (leve, sem libs) ----- */

function IconGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  )
}

function IconStore() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 10l2-6h14l2 6M5 10v10h14V10M9 20v-7h6v7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconBoxes() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M21 16V8l-9-5-9 5v8l9 5 9-5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M3.3 7.6 12 12l8.7-4.4M12 22V12"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  )
}

function IconTag() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 10V4h-6L4 14l6 6 10-10Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M16 8h.01"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 21a8 8 0 1 0-16 0"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  )
}

function IconCart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 6h15l-2 9H7L6 6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M6 6 5 3H2M7 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm12 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  )
}

function IconWallet() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 7h18v14H3V7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M3 7V5a2 2 0 0 1 2-2h14v4"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M17 13h4v4h-4a2 2 0 0 1 0-4Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  )
}

function IconMegaphone() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 11v2a2 2 0 0 0 2 2h2l8 4V5l-8 4H5a2 2 0 0 0-2 2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M21 9v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconChart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 19V5M4 19h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8 17V9M12 17V7M16 17v-5M20 17v-8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconHelp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1.5 1.1-1.5 2.2v.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 17h.01"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M16.5 16.5 21 21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
