// src/app/page.tsx
"use client"

// ✅ Home pública (Landing + Login)
// - Sem menus
// - Logo grande
// - Design igual o sistema (Tebas azul claro)
// - Login integrado com Supabase
// - Mobile first

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { supabase } from "@/lib/supabase/client"

export default function HomePage() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const canSubmit = useMemo(() => {
    return !!email.trim() && !!password.trim() && !loading
  }, [email, password, loading])

  async function onLogin() {
    setMsg(null)
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setMsg(error.message)
      setLoading(false)
      return
    }

    if (!data.session) {
      setMsg("Não foi possível iniciar sessão. Tente novamente.")
      setLoading(false)
      return
    }

    router.push("/app/loja")
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#EAF7FF]">
      {/* Top strip */}
      <header className="px-6 pt-6">
        <div className="mx-auto max-w-6xl rounded-3xl bg-white/70 border border-black/5 shadow-sm px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#EAF7FF] border border-black/5 flex items-center justify-center">
              <IconSpark />
            </div>
            <div className="text-sm font-semibold text-slate-900">Tebas Tech</div>
          </div>

          <div className="text-xs text-slate-600">
            Gestão simples para pequenos comércios
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="px-6 pb-14">
        <div className="mx-auto max-w-6xl pt-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Left: pitch */}
            <section className="rounded-3xl bg-white border border-black/5 shadow-sm p-6 lg:p-8">
              <div className="flex items-start gap-4">
                <Image
                  src="/logos4.png"
                  alt="Tebas Tech"
                  width={900}
                  height={260}
                  className="w-full max-w-[360px] h-auto object-contain"
                  priority
                />
              </div>

              <h1 className="mt-6 text-3xl lg:text-4xl font-semibold text-slate-900 leading-tight">
                Controle total do estoque, vendas organizadas e lucro claro.
              </h1>

              <p className="mt-3 text-slate-700 text-base leading-relaxed">
                O Tebas Tech foi feito para <b>dono de loja</b>: rápido no celular, sem complicação,
                com registro de vendas e despesas, e números que fazem sentido no fim do dia.
              </p>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <HeroBadge
                  title="Estoque inteligente"
                  desc="Alertas, mínimo e ajuste rápido."
                  icon={<IconBox />}
                />
                <HeroBadge
                  title="Vendas em segundos"
                  desc="Baixa estoque e salva histórico."
                  icon={<IconCart />}
                />
                <HeroBadge
                  title="Resultado do dia"
                  desc="Receita, despesas e lucro estimado."
                  icon={<IconChart />}
                />
              </div>

              <div className="mt-7 rounded-3xl bg-[#EAF7FF] border border-black/5 p-5">
                <div className="text-sm font-semibold text-slate-900">
                  Por que isso importa?
                </div>
                <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                  Caderno e WhatsApp são rápidos, mas viram bagunça: estoque errado, compra sem controle,
                  preço sem margem e dinheiro que “some”.
                  O Tebas Tech centraliza tudo e mostra o que está acontecendo <b>de verdade</b>.
                </p>
              </div>
            </section>

            {/* Right: login + mini preview */}
            <section className="rounded-3xl bg-white border border-black/5 shadow-sm p-6 lg:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-slate-900">Entrar</div>
                  <div className="text-sm text-slate-600 mt-1">
                    Acesse sua loja e comece a registrar hoje.
                  </div>
                </div>
                <div className="h-11 w-11 rounded-2xl bg-[#EAF7FF] border border-black/5 flex items-center justify-center">
                  <IconLock />
                </div>
              </div>

              {msg ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {msg}
                </div>
              ) : null}

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">E-mail</span>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                    autoComplete="email"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Senha</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                    autoComplete="current-password"
                  />
                </label>

                <button
                  onClick={onLogin}
                  disabled={!canSubmit}
                  className="h-11 w-full rounded-2xl bg-[#00D6FF] text-slate-900 text-sm font-semibold hover:brightness-95 disabled:opacity-60"
                >
                  {loading ? "Entrando..." : "Entrar no sistema"}
                </button>

                <div className="text-xs text-slate-600">
                  (Cadastro e recuperação de senha você controla na área admin depois.)
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MiniCard
                  title="Histórico completo"
                  desc="Vendas e despesas com exportação em Excel."
                  icon={<IconList />}
                />
                <MiniCard
                  title="Custo e margem"
                  desc="Compras atualizam o custo do produto para medir lucro."
                  icon={<IconTag />}
                />
              </div>

              <div className="mt-6 rounded-3xl border border-black/5 bg-slate-50 p-5">
                <div className="text-sm font-semibold text-slate-900">Como funciona</div>
                <ol className="mt-2 space-y-2 text-sm text-slate-700">
                  <li className="flex gap-3">
                    <StepN n="1" />
                    <span>Cadastre seus produtos e o estoque mínimo.</span>
                  </li>
                  <li className="flex gap-3">
                    <StepN n="2" />
                    <span>Registre vendas e despesas do dia (rápido no celular).</span>
                  </li>
                  <li className="flex gap-3">
                    <StepN n="3" />
                    <span>Veja o resultado no dashboard e ajuste compras e preços.</span>
                  </li>
                </ol>
              </div>
            </section>
          </div>

          {/* Bottom features row */}
          <section className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <BigFeature
              title="Feito para toque"
              desc="Campos grandes, poucos cliques e tabelas estilo Kyte."
              icon={<IconPhone />}
            />
            <BigFeature
              title="Multi-loja"
              desc="Cada usuário vê apenas sua loja. Você cria o acesso para testar."
              icon={<IconShield />}
            />
            <BigFeature
              title="Leve e rápido"
              desc="Interface limpa e direta, sem excesso de botões ou telas confusas."
              icon={<IconBolt />}
            />
          </section>

          <footer className="mt-10 text-center text-xs text-slate-600">
            © {new Date().getFullYear()} Tebas Tech • Sistema de gestão para pequenos comércios
          </footer>
        </div>
      </main>
    </div>
  )
}

/* ================= UI Bits ================= */

function HeroBadge({
  title,
  desc,
  icon,
}: {
  title: string
  desc: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-slate-50 p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-[#EAF7FF] border border-black/5 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="text-xs text-slate-600 mt-0.5">{desc}</div>
        </div>
      </div>
    </div>
  )
}

function MiniCard({
  title,
  desc,
  icon,
}: {
  title: string
  desc: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-10 w-10 rounded-2xl bg-[#EAF7FF] border border-black/5 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="text-xs text-slate-600 mt-1 leading-relaxed">{desc}</div>
        </div>
      </div>
    </div>
  )
}

function BigFeature({
  title,
  desc,
  icon,
}: {
  title: string
  desc: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-3xl bg-white border border-black/5 shadow-sm p-6">
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-2xl bg-[#EAF7FF] border border-black/5 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="text-sm text-slate-600 mt-1 leading-relaxed">{desc}</div>
        </div>
      </div>
    </div>
  )
}

function StepN({ n }: { n: string }) {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#00D6FF] text-slate-900 text-xs font-bold">
      {n}
    </span>
  )
}

/* ================= Icons (SVG) ================= */

function IconSpark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l1.2 4.2L17 7.5l-3.8 1.3L12 13l-1.2-4.2L7 7.5l3.8-1.3L12 2Z" />
      <path d="M5 14l.7 2.5L8 17.2l-2.3.7L5 20l-.7-2.1L2 17.2l2.3-.7L5 14Z" />
      <path d="M19 13l.8 2.8 2.2.7-2.2.7L19 20l-.8-2.1-2.2-.7 2.2-.7L19 13Z" />
    </svg>
  )
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 11V8a5 5 0 0 1 10 0v3" />
      <path d="M6 11h12v10H6z" />
      <path d="M12 16v2" />
    </svg>
  )
}

function IconBox() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 8l-9-5-9 5 9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  )
}

function IconCart() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6h15l-2 9H7L6 6Z" />
      <path d="M6 6 5 3H2" />
      <path d="M7 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm12 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    </svg>
  )
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19V5M4 19h16" />
      <path d="M8 17V9M12 17V7M16 17v-5M20 17v-8" />
    </svg>
  )
}

function IconList() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </svg>
  )
}

function IconTag() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 10V4h-6L4 14l6 6 10-10Z" />
      <path d="M16 8h.01" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 2h10v20H7z" />
      <path d="M11 18h2" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2 20 6v6c0 5-3.5 9.4-8 10-4.5-.6-8-5-8-10V6l8-4Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}

function IconBolt() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
    </svg>
  )
}
