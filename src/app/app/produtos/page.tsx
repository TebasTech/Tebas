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
  marca: string | null
  fornecedor: string | null
  preco: number | null
  estoque_minimo: number | null
}

const TIPOS = [
  { value: "", label: "Selecione..." },
  { value: "ração pacote", label: "Ração (pacote)" },
  { value: "ração granel", label: "Ração (granel)" },
  { value: "diversos", label: "Diversos" },
  { value: "outros", label: "Outros" },
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
  const [marca, setMarca] = useState("")
  const [fornecedor, setFornecedor] = useState("")
  const [tipo, setTipo] = useState<string>("") // <-- começa vazio (Selecione...)
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
      .select("id, store_id, codigo, tipo, descricao, marca, fornecedor, preco, estoque_minimo")
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
    setMarca("")
    setFornecedor("")
    setTipo("") // <-- volta para "Selecione..."
    setPreco("")
  }

  function toNumberBR(v: string) {
    const t = String(v ?? "").trim()
    if (!t) return 0
    const norm = t.replace(/\./g, "").replace(",", ".")
    const n = Number(norm)
    if (!Number.isFinite(n)) return 0
    return n
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

    const price = toNumberBR(preco)
    if (!Number.isFinite(price) || price < 0) {
      setErrorMsg("Preço inválido.")
      return
    }

    setSaving(true)

    // gerar código sequencial (max+1) por loja
    const mx = await supabase
      .from("products")
      .select("codigo")
      .eq("store_id", storeId)
      .order("codigo", { ascending: false, nullsFirst: false })
      .limit(1)

    const last = (mx.data?.[0]?.codigo ?? 0) as number
    const nextCodigo = (Number.isFinite(last) ? last : 0) + 1

    const payload = {
      store_id: storeId,
      codigo: nextCodigo,
      tipo,
      descricao: d,
      marca: marca.trim() ? marca.trim() : null,
      fornecedor: fornecedor.trim() ? fornecedor.trim() : null,
      preco: price,
      estoque_minimo: 0,
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

          <input
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            placeholder="Marca (opcional)"
            className="w-full md:w-[220px] h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          />

          <input
            value={fornecedor}
            onChange={(e) => setFornecedor(e.target.value)}
            placeholder="Fornecedor (opcional)"
            className="w-full md:w-[240px] h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          />

          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="w-full md:w-[220px] h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          >
            {TIPOS.map((t) => (
              <option key={t.value || "empty"} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <input
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            placeholder="Preço (ex: 12,50)"
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
                  <th className="text-left font-semibold px-4 py-3">Produto</th>
                  <th className="text-left font-semibold px-4 py-3">Categoria</th>
                  <th className="text-right font-semibold px-4 py-3">Preço</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {items.map((p) => (
                  <tr key={p.id} className="border-t border-black/5 hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-700">{p.codigo ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-900">
                      <div className="font-semibold">{p.descricao}</div>
                      <div className="text-xs text-slate-500">
                        {p.marca ? `Marca: ${p.marca}` : ""}
                        {p.fornecedor ? ` • Forn.: ${p.fornecedor}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{p.tipo ?? "-"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      R$ {(Number(p.preco ?? 0)).toFixed(2).replace(".", ",")}
                    </td>
                  </tr>
                ))}
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
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
