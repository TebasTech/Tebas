"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"

type StoreRow = { id: string; name: string | null }

export default function LojaPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [storeId, setStoreId] = useState<string | null>(null)
  const [storeName, setStoreName] = useState<string>("Loja")
  const [storeNameDraft, setStoreNameDraft] = useState<string>("")

  async function getStoreIdOrRedirect(): Promise<string | null> {
    setErrorMsg(null)

    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user

    if (!user) {
      router.push("/login")
      return null
    }

    const { data, error } = await supabase
      .from("users_profile")
      .select("store_id")
      .eq("id", user.id)
      .single()

    if (error) {
      setErrorMsg(`Erro ao buscar loja do usuário: ${error.message}`)
      return null
    }

    if (!data?.store_id) {
      setErrorMsg("Seu usuário não está vinculado a nenhuma loja (store_id).")
      return null
    }

    return String(data.store_id)
  }

  async function loadStore(currentStoreId: string) {
    setErrorMsg(null)
    setLoading(true)

    const { data, error } = await supabase
      .from("stores")
      .select("id, name")
      .eq("id", currentStoreId)
      .single()

    if (error) {
      setErrorMsg(`Erro ao carregar loja: ${error.message}`)
      setLoading(false)
      return
    }

    const row = data as StoreRow
    const name = (row.name || "").trim()

    setStoreName(name || "Minha loja")
    setStoreNameDraft(name || "")
    setLoading(false)
  }

  useEffect(() => {
    ;(async () => {
      const sid = await getStoreIdOrRedirect()
      if (!sid) {
        setLoading(false)
        return
      }
      setStoreId(sid)
      await loadStore(sid)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onSave() {
    setErrorMsg(null)
    if (!storeId) return

    const name = storeNameDraft.trim()
    if (!name) {
      alert("Digite o nome da loja.")
      return
    }

    setSaving(true)

    const { error } = await supabase.from("stores").update({ name }).eq("id", storeId)

    if (error) {
      setErrorMsg(`Erro ao salvar: ${error.message}`)
      setSaving(false)
      return
    }

    setStoreName(name)
    setStoreNameDraft(name)
    setSaving(false)
  }

  async function onRefresh() {
    if (!storeId) return
    await loadStore(storeId)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-11 w-11 rounded-2xl bg-[#EAF7FF] border border-black/5 flex items-center justify-center">
            <IconStore />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{storeName}</h1>
            <p className="text-sm text-slate-600 mt-1">
              Informações básicas da loja.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full md:w-auto md:flex-row">
          <button
            onClick={onRefresh}
            disabled={loading || saving}
            className="h-11 px-5 rounded-2xl bg-white border border-black/10 text-slate-900 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 w-full md:w-auto"
          >
            {loading ? "Carregando..." : "Atualizar"}
          </button>

          <button
            onClick={onSave}
            disabled={saving || loading}
            className="h-11 px-5 rounded-2xl bg-[#22C55E] text-white text-sm font-semibold hover:brightness-95 disabled:opacity-60 w-full md:w-auto"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>

      {errorMsg ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-slate-600">Carregando…</div>
      ) : (
        <section className="rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-black/5">
            <div className="text-sm font-semibold text-slate-900">Identificação</div>
            <div className="text-xs text-slate-600 mt-1">
              O nome aparece no topo e nos relatórios.
            </div>
          </div>

          <div className="p-5">
            <label className="block max-w-xl">
              <span className="text-sm font-semibold text-slate-800">Nome da loja</span>
              <input
                value={storeNameDraft}
                onChange={(e) => setStoreNameDraft(e.target.value)}
                placeholder="Ex: Casa de Ração Randrey"
                className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
              />
            </label>
          </div>
        </section>
      )}
    </div>
  )
}

function IconStore() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10l2-6h14l2 6M5 10v10h14V10M9 20v-7h6v7" />
    </svg>
  )
}
