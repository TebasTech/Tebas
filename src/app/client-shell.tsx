"use client"

import { ReactNode } from "react"
import Link from "next/link"
import Image from "next/image"

import { I18nProvider, useI18n } from "@/lib/i18n/provider"
import LanguageSwitcher from "@/components/language-switcher"

export default function ClientShell({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
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
    </I18nProvider>
  )
}

function Sidebar() {
  const { t } = useI18n()

  return (
    <aside className="hidden md:flex w-[290px] flex-col border-r border-black/5 bg-gradient-to-b from-[#D6F2FF] via-[#C6EDFF] to-[#B8E8FF]">
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

      <div className="flex-1 px-4 py-4">
        <nav className="h-full rounded-3xl bg-white/50 border border-[#7DD9FF] p-2 flex flex-col gap-2">
          <NavItem href="/app/loja" label={t("nav.store")} />
          <NavItem href="/app/estoque" label={t("nav.stock")} />
          <NavItem href="/app/produtos" label={t("nav.products")} />
          <NavItem href="/app/clientes" label={t("nav.customers")} />
          <NavItem href="/app/vendas" label={t("nav.sales")} />
          <NavItem href="/app/financeiro" label={t("nav.finance")} />
          <NavItem href="/app/marketing" label={t("nav.marketing")} />
          <NavItem href="/app/estatisticas" label={t("nav.stats")} />

          <div className="mt-auto">
            <NavItem href="/app/ajuda" label={t("nav.help")} />
          </div>
        </nav>
      </div>
    </aside>
  )
}

function Topbar() {
  const { t } = useI18n()

  return (
    <header className="h-16 bg-white border-b border-black/5 flex items-center justify-end px-6 gap-3">
      <LanguageSwitcher />
      <div className="text-sm text-slate-700 pl-1">{t("app.account")}</div>
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
