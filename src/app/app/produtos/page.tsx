"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"

type Product = {
  id: string
  store_id: string
  codigo: number | null
  tipo: string | null
  descricao: string
  estoque_minimo: number | null
  preco: number | null
}

const CATEGORIAS = [
  { value: "", label: "Selecione..." },
  { value: "ração pacote", label: "Ração" },
  { value: "ração granel", label: "Ração granel" },
  { value: "diversos", label: "Diversos" },
]

export default function ProdutosPage() {
  const router = useRouter()

  const [storeId, setStoreId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  const [items, setItems] = useState<Product[]>([])

  // form
  const [descricao, setDescricao] = useState("")
  const [tipo, setTipo] = useState<string>("")
  const [estoqueMinimo, setEstoqueMinimo] = useState("0")
  const [preco, setPreco] = useState("")

  async function getStoreIdOrRedirect() {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) {
      router.push("/login")
      return null
    }

    const { data, error } = await supabase
      .from("users_profile")
      .select("store_id")
      .eq("id", auth.user.id)
      .single()

    if (error) {
      setErrorMsg(`Erro ao buscar loja do usuário: ${error.message}`)
      return null
    }

    if (!data?.store_id) {
      setErrorMsg("Seu usuário não está vinculado a nenhuma loja (store_id).")
      return null
    }

    return data.store_id as string
  }

  async function loadProducts(sid: string) {
    setErrorMsg(null)

    const { data, error } = await supabase
      .from("products")
      .select("id, store_id, codigo, tipo, descricao, estoque_minimo, preco")
      .eq("store_id", sid)
      .order("codigo", { ascending: true, nullsFirst: false })

    if (error) {
      setErrorMsg(`Erro ao carregar produtos: ${error.message}`)
      setItems([])
      return
    }

    setItems((data as Product[]) ?? [])
  }

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const sid = await getStoreIdOrRedirect()
      if (!sid) {
        setLoading(false)
        return
      }
      setStoreId(sid)
      await loadProducts(sid)
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalCount = useMemo(() => items.length, [items])

  function resetForm() {
    setDescricao("")
    setTipo("")
    setEstoqueMinimo("0")
    setPreco("")
  }

  function toNumberBR(v: string) {
    const t = String(v ?? "").trim()
    if (!t) return 0
    const norm = t.replace(/\./g, "").replace(",", ".")
    const n = Number(norm)
    return Number.isFinite(n) ? n : 0
  }

  async function onSave() {
    setErrorMsg(null)
    setOkMsg(null)

    if (!storeId) {
      setErrorMsg("Loja não identificada.")
      return
    }

    const d = descricao.trim()
    if (!d) {
      setErrorMsg("Preencha a descrição.")
      return
    }

    if (!tipo) {
      setErrorMsg("Selecione a categoria.")
      return
    }

    const min = Number(String(estoqueMinimo).replace(",", "."))
    if (!Number.isFinite(min) || min < 0) {
      setErrorMsg("Estoque mínimo inválido.")
      return
    }

    const price = toNumberBR(preco)
    if (!Number.isFinite(price) || price < 0) {
      setErrorMsg("Valor inválido.")
      return
    }

    setSaving(true)

    // não manda "codigo": o banco gera sozinho (identity)
    const payload = {
      store_id: storeId,
      tipo,
      descricao: d,
      estoque_minimo: Math.floor(min),
      preco: price,
    }

    const { error } = await supabase.from("products").insert(payload)

    if (error) {
      setSaving(false)
      setErrorMsg(`Erro ao salvar: ${error.message}`)
      return
    }

    setSaving(false)
    setOkMsg("Produto cadastrado.")
    resetForm()
    await loadProducts(storeId)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Produtos</h1>
        <p className="text-sm text-slate-600 mt-1">Cadastre itens e preços.</p>
      </div>

      {errorMsg ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>
      ) : null}

      {okMsg ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {okMsg}
        </div>
      ) : null}

      <section className="rounded-2xl border border-black/5 bg-white shadow-sm p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição"
            className="flex-1 h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          />

          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="w-full md:w-[220px] h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          >
            {CATEGORIAS.map((t) => (
              <option key={t.value || "empty"} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <input
            value={estoqueMinimo}
            onChange={(e) => setEstoqueMinimo(e.target.value)}
            placeholder="Estoque mínimo"
            inputMode="numeric"
            className="w-full md:w-[180px] h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          />

          <input
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            placeholder="Valor (ex: 12,50)"
            inputMode="decimal"
            className="w-full md:w-[180px] h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          />

          <button
            onClick={onSave}
            disabled={saving || loading}
            className="h-11 px-6 rounded-2xl bg-[#00D6FF] text-slate-900 text-sm font-semibold hover:brightness-95 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Itens</div>
          <div className="text-sm text-slate-600">{totalCount}</div>
        </div>

        {loading ? (
          <div className="px-5 py-6 text-sm text-slate-600">Carregando…</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">ID</th>
                  <th className="text-left font-semibold px-4 py-3">Descrição</th>
                  <th className="text-left font-semibold px-4 py-3">Categoria</th>
                  <th className="text-right font-semibold px-4 py-3">Estoque mín.</th>
                  <th className="text-right font-semibold px-4 py-3">Valor</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {items.map((p) => (
                  <tr key={p.id} className="border-t border-black/5 hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-700">{p.codigo ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-900 font-semibold">{p.descricao}</td>
                    <td className="px-4 py-3 text-slate-700">{p.tipo ?? "-"}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{p.estoque_minimo ?? 0}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      R$ {(Number(p.preco ?? 0)).toFixed(2).replace(".", ",")}
                    </td>
                  </tr>
                ))}
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      Nenhum produto cadastrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
