"use client"

import { ReactNode, useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase/client"

export default function ClientShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  // ✅ proteção: só protege rotas /app
  useEffect(() => {
    let cancelled = false

    async function check() {
      const { data, error } = await supabase.auth.getSession()
      if (cancelled) return

      // se falhar sessão, manda pro login
      if (error || !data.session) {
        router.replace("/login")
      }
    }

    // só checa se estiver em /app
    if (pathname?.startsWith("/app")) check()

    return () => {
      cancelled = true
    }
  }, [router, pathname])

  return (
    <div className="flex h-screen">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Topbar />

        <main className="flex-1 overflow-auto bg-[#EAF7FF] p-6">
          <div className="min-h-[calc(100vh-6rem)] rounded-2xl bg-white border border-black/5 shadow-sm p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
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
          priority
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
            <NavItem href="/app/loja" label="Loja" />
            <NavItem href="/app/estoque" label="Estoque" />
            <NavItem href="/app/produtos" label="Produtos" />
            <NavItem href="/app/clientes" label="Clientes" />
            <NavItem href="/app/vendas" label="Vendas" />
            <NavItem href="/app/financeiro" label="Compras & Despesas" />
            <NavItem href="/app/marketing" label="Marketing" />
            <NavItem href="/app/estatisticas" label="Estatísticas" />

            <div className="mt-auto">
              <NavItem href="/app/ajuda" label="Ajuda" />
            </div>
          </nav>
        </div>
      </aside>
    </>
  )
}

function Topbar() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function onLogout() {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  return (
    <header className="h-16 bg-white border-b border-black/5 flex items-center justify-end px-6">
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="h-11 px-5 rounded-2xl bg-white border border-black/10 text-slate-900 text-sm font-semibold hover:bg-slate-50"
        >
          Conta
        </button>

        {open ? (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 mt-2 z-50 w-44 rounded-2xl bg-white border border-black/10 shadow-lg overflow-hidden">
              <button
                onClick={() => {
                  setOpen(false)
                  router.push("/app/loja")
                }}
                className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Loja
              </button>

              <button
                onClick={() => {
                  setOpen(false)
                  onLogout()
                }}
                className="w-full text-left px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Sair
              </button>
            </div>
          </>
        ) : null}
      </div>
    </header>
  )
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl px-4 py-2.5 bg-[#BFEAFF] border border-[#7DD9FF] text-slate-900 hover:bg-[#AEE3FF] transition"
    >
      <span className="font-semibold text-[13px]">{label}</span>
    </Link>
  )
}
