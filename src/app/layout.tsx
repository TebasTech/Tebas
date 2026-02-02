import "./globals.css"
import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
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

            <main className="flex-1 overflow-auto bg-[#EAF7FF] p-6">
              <div className="min-h-[calc(100vh-6rem)] rounded-2xl bg-white border border-black/5 shadow-sm p-6">
                {children}
              </div>
            </main>
            <a
  href="https://wa.me/400778756849?text=Ol%C3%A1%20Tebas%20Tech!%20Preciso%20de%20ajuda%20no%20sistema."
  target="_blank"
  rel="noreferrer"
  className="fixed bottom-5 left-5 z-50 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#22C55E] shadow-lg hover:brightness-95"
  aria-label="Falar com suporte no WhatsApp"
  title="Falar com suporte no WhatsApp"
>
  <svg
    viewBox="0 0 32 32"
    fill="currentColor"
    className="h-5 w-5 text-white"
    aria-hidden="true"
  >
    <path d="M19.11 17.53c-.27-.14-1.6-.79-1.84-.88-.25-.09-.43-.14-.61.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07-.27-.14-1.14-.42-2.17-1.33-.8-.71-1.34-1.59-1.5-1.86-.16-.27-.02-.41.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.84-2.02-.22-.53-.45-.46-.61-.46l-.52-.01c-.18 0-.48.07-.73.34-.25.27-.95.93-.95 2.27 0 1.33.98 2.62 1.12 2.8.14.18 1.93 2.95 4.68 4.13.65.28 1.16.45 1.56.57.66.21 1.26.18 1.73.11.53-.08 1.6-.65 1.83-1.27.23-.62.23-1.15.16-1.27-.07-.12-.25-.2-.52-.34z" />
    <path d="M26.64 5.36A13.1 13.1 0 0016.02 1C8.84 1 3 6.84 3 14.02c0 2.3.6 4.55 1.74 6.54L3 31l10.7-1.68a12.98 12.98 0 006.32 1.62h.01C27.2 30.94 33 25.1 33 17.92c0-3.49-1.36-6.77-3.83-9.23zM16.03 28.7h-.01a10.8 10.8 0 01-5.51-1.52l-.4-.24-6.35 1 1.04-6.19-.26-.44a10.77 10.77 0 01-1.63-5.73C2.92 8.06 8.07 2.9 14.44 2.9c2.88 0 5.58 1.12 7.61 3.15a10.7 10.7 0 013.16 7.6c0 6.37-5.16 11.53-11.18 11.05z" />
  </svg>
</a>

          </div>
        </div>
      </body>
    </html>
  )
}

function Sidebar() {
  return (
    <>
      {/* MOBILE HEADER */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-black/5 flex items-center px-4 z-50">
        <Image
          src="/logos4.png"
          alt="Tebas Tech"
          width={140}
          height={40}
          className="h-8 w-auto object-contain"
        />
      </div>

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex w-[290px] flex-col border-r border-black/5 bg-gradient-to-b from-[#D6F2FF] via-[#C6EDFF] to-[#B8E8FF]">
        {/* LOGO */}
        <div className="px-4 pt-4 pb-3 border-b border-black/5">
          <Image
            src="/logos4.png"
            alt="Tebas Tech"
            width={800}
            height={220}
            className="w-full h-auto object-contain"
            priority
          />
        </div>

        {/* MENU */}
        <div className="flex-1 px-4 py-4">
          <nav className="h-full rounded-3xl bg-white/50 border border-[#7DD9FF] p-2 flex flex-col gap-2">
            <NavItem href="/app/loja" label="Loja" icon={<IconStore />} />
            <NavItem href="/app/estoque" label="Estoque" icon={<IconBoxes />} />
            <NavItem href="/app/produtos" label="Produtos" icon={<IconTag />} />
            <NavItem href="/app/clientes" label="Clientes" icon={<IconUser />} />
            <NavItem href="/app/vendas" label="Vendas" icon={<IconCart />} />
            <NavItem href="/app/financeiro" label="Compras & Despesas" icon={<IconWallet />} />
            <NavItem href="/app/marketing" label="Marketing" icon={<IconMegaphone />} />
            <NavItem href="/app/estatisticas" label="Estatísticas" icon={<IconChart />} />

            <div className="mt-auto">
              <NavItem href="/app/ajuda" label="Ajuda" icon={<IconHelp />} />
            </div>
          </nav>
        </div>
      </aside>
    </>
  )
}


function Topbar() {
  return (
    <header className="h-16 bg-white border-b border-black/5 flex items-center justify-between px-6">
      <div className="flex items-center gap-3 w-full max-w-xl">
        <div className="relative w-full">
          <input
            placeholder="Buscar… (produto, cliente, venda)"
            className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-10 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50">
            <IconSearch />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="h-11 px-5 rounded-2xl bg-[#00D6FF] text-slate-900 text-sm font-semibold hover:brightness-95">
          + Produto
        </button>

        <div className="text-sm text-slate-700 pl-1">Conta</div>
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
      className="flex items-center gap-3 rounded-2xl px-4 py-2.5 bg-[#BFEAFF] border border-[#7DD9FF] text-slate-900 hover:bg-[#AEE3FF] transition"
    >
      <span className="text-slate-700">{icon}</span>
      <span className="font-semibold text-[13px]">{label}</span>
    </Link>
  )
}

/* ----- Icons ----- */

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
      <path d="M20 21a8 8 0 1 0-16 0" stroke="currentColor" strokeWidth="2" />
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
      <path d="M21 9v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
      <path d="M12 17h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
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
