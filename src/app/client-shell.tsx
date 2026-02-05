"use client"

import { ReactNode, useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"

import LanguageSwitcher from "@/components/language-switcher"
import { I18nProvider, useI18n } from "@/lib/i18n/provider"

export default function ClientShell({ children }: { children: ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getSession()
      if (!data.session) router.replace("/login")
    }
    check()
  }, [router])

  return (
    <I18nProvider>
      <div className="flex h-screen">
        <Sidebar />

        <div className="flex-1 flex flex-col">
          <Topbar />

          <main className="flex-1 overflow-auto bg-[#EAF7FF] p-4">
            <div className="min-h-full rounded-2xl bg-white border border-black/5 shadow-sm p-4">
              {children}
            </div>
          </main>
        </div>
      </div>
    </I18nProvider>
  )
}

function Sidebar() {
  const pathname = usePathname()
  const { t } = useI18n()

  return (
    <aside className="hidden md:flex w-[240px] flex-col border-r border-black/5 bg-gradient-to-b from-[#D6F2FF] via-[#C6EDFF] to-[#B8E8FF]">
      {/* LOGO */}
      <div className="px-3 py-3 border-b border-black/5">
        <Image
          src="/logos4.png"
          alt="Tebas Tech"
          width={600}
          height={180}
          className="w-full h-auto object-contain"
          priority
        />
      </div>

      {/* MENU */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-1 text-[13px]">

        {/* ✅ NOVA ORDEM PEDIDA */}
        <NavItem href="/app/loja" label={t("nav.store")} active={pathname === "/app/loja"} />
        <NavItem href="/app/produtos" label={t("nav.products")} active={pathname === "/app/produtos"} />
        <NavItem href="/app/estoque" label={t("nav.stock")} active={pathname === "/app/estoque"} />

        <NavItem href="/app/clientes" label={t("nav.customers")} active={pathname === "/app/clientes"} />
        <NavItem href="/app/vendas" label={t("nav.sales")} active={pathname === "/app/vendas"} />
        <NavItem href="/app/financeiro" label={t("nav.finance")} active={pathname === "/app/financeiro"} />
        <NavItem href="/app/marketing" label={t("nav.marketing")} active={pathname === "/app/marketing"} />
        <NavItem href="/app/estatisticas" label={t("nav.stats")} active={pathname === "/app/estatisticas"} />

        <div className="mt-auto">
          <NavItem href="/app/ajuda" label={t("nav.help")} active={pathname === "/app/ajuda"} />
        </div>
      </nav>
    </aside>
  )
}

function Topbar() {
  const { t } = useI18n()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function clickOutside(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", clickOutside)
    return () => document.removeEventListener("mousedown", clickOutside)
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  return (
    <header className="h-14 bg-white border-b border-black/5 flex items-center justify-end px-4 gap-3">

      <LanguageSwitcher />

      {/* MENU CONTA */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold hover:bg-slate-50"
        >
          {t("app.account")}
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-40 rounded-xl border border-black/10 bg-white shadow-lg p-2 text-sm">
            <Link
              href="/app/loja"
              className="block px-3 py-2 rounded-lg hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              Loja
            </Link>

            <button
              onClick={logout}
              className="w-full text-left px-3 py-2 rounded-lg text-red-600 hover:bg-red-50"
            >
              Sair
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

function NavItem({
  href,
  label,
  active,
}: {
  href: string
  label: string
  active?: boolean
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl px-3 py-2 transition font-medium
        ${active
          ? "bg-[#AEE3FF] border border-[#7DD9FF]"
          : "hover:bg-[#DFF4FF]"
        }`}
    >
      {label}
    </Link>
  )
}
