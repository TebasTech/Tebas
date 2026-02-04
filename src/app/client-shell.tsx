// src/app/client-shell.tsx
"use client"

// ✅ Atualização: carrega role do usuário e mostra link Admin só para role='admin'

import { ReactNode, useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"

import { supabase } from "@/lib/supabase/client"
import { I18nProvider, useI18n } from "@/lib/i18n/provider"
import LanguageSwitcher from "@/components/language-switcher"

type Profile = { store_id: string | null; role: string | null }

export default function ClientShell({ children }: { children: ReactNode }) {
  const router = useRouter()

  const [checked, setChecked] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let mounted = true

    async function readRole() {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) return

      const { data: prof } = await supabase
        .from("users_profile")
        .select("role")
        .eq("id", user.id)
        .single()

      if (!mounted) return
      const role = String((prof as any)?.role || "").toLowerCase()
      setIsAdmin(role === "admin")
    }

    async function check() {
      const { data } = await supabase.auth.getSession()
      const ok = !!data.session

      if (!mounted) return

      setAllowed(ok)
      setChecked(true)

      if (!ok) {
        router.replace("/login")
        return
      }

      await readRole()
    }

    check()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const ok = !!session
      if (!mounted) return
      setAllowed(ok)
      setChecked(true)

      if (!ok) {
        router.replace("/login")
        return
      }

      await readRole()
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [router])

  if (!checked) return null
  if (!allowed) return null

  return (
    <I18nProvider>
      <div className="flex h-screen">
        <Sidebar isAdmin={isAdmin} />

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

function Sidebar({ isAdmin }: { isAdmin: boolean }) {
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

          {isAdmin ? (
            <div className="mt-2">
              <div className="px-4 pt-3 pb-1 text-[11px] font-semibold text-slate-600">
                Admin
              </div>
              <NavItem href="/app/admin" label="Admin Tebas" />
            </div>
          ) : null}

          <div className="mt-auto">
            <NavItem href="/app/ajuda" label={t("nav.help")} />
          </div>
        </nav>
      </div>
    </aside>
  )
}

function Topbar() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  async function onLogout() {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  return (
    <header className="h-16 bg-white border-b border-black/5 flex items-center justify-end px-6 gap-3">
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="h-11 px-5 rounded-2xl bg-white border border-black/10 text-slate-900 text-sm font-semibold hover:bg-slate-50"
        >
          Conta
        </button>

        {open ? (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
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
