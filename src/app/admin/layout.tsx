import type { ReactNode } from "react"
import Link from "next/link"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F4FBFF] flex">
      {/* Sidebar admin */}
      <aside className="w-[260px] bg-white border-r border-black/5 p-5 hidden md:flex flex-col">
        <div className="text-lg font-semibold text-slate-900 mb-6">
          Tebas Admin
        </div>

        <nav className="space-y-2">
          <MenuItem href="/admin" label="Dashboard" />
          <MenuItem href="/admin/lojas" label="Lojas" />
          <MenuItem href="/admin/clientes" label="Clientes" />
          <MenuItem href="/admin/suporte" label="Suporte" />
          <MenuItem href="/app" label="Abrir área do cliente" />
        </nav>

        <div className="mt-auto text-xs text-slate-500">Tebas Tech • Admin</div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 p-6 md:p-10">{children}</main>
    </div>
  )
}

function MenuItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-[#EAF7FF] transition"
    >
      {label}
    </Link>
  )
}
