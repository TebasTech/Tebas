"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function onLogin() {
    setMsg(null)
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
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

    // Vai para a área do cliente
    router.push("/app/loja")
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#EAF7FF] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white border border-black/5 shadow-sm p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Entrar</h1>
        <p className="text-sm text-slate-600 mt-1">
          Acesse sua loja na Tebas Tech.
        </p>

        {msg ? (
          <div className="mt-4 rounded-2xl border border-black/10 bg-slate-50 px-4 py-3 text-sm text-slate-700">
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
            />
          </label>

          <button
            onClick={onLogin}
            disabled={loading}
            className="h-11 w-full rounded-2xl bg-[#00D6FF] text-slate-900 text-sm font-semibold hover:brightness-95 disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <div className="text-xs text-slate-600">
            (Cadastro e recuperação de senha a gente adiciona depois.)
          </div>
        </div>
      </div>
    </div>
  )
}
