"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"

type Product = {
  id: string
  store_id: string | null
  codigo: number | null
  tipo: string
  descricao: string
  marca: string | null
  fornecedor: string | null
  preco: number
  estoque_minimo: number | null
  created_at: string | null
}

const MIN_OPTIONS = [
  "-", "1", "2", "3", "4", "5", "8", "10", "12", "15", "20", "25", "30", "40", "50", "75", "100"
]

export default function ProdutosPage() {
  const router = useRouter()

  const [storeId, setStoreId] = useState<string | null>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [q, setQ] = useState("")
  const [brandOrSupplier, setBrandOrSupplier] = useState("")

  const [isOpen, setIsOpen] = useState(false)

  const [tipo, setTipo] = useState("")
  const [descricao, setDescricao] = useState("")
  const [marca, setMarca] = useState("Outros")
  const [fornecedor, setFornecedor] = useState("")
  const [preco, setPreco] = useState("")
  const [estoqueMinimo, setEstoqueMinimo] = useState<string>("-")

  // ✅ controle do dropdown do Tipo
  const [tipoOpen, setTipoOpen] = useState(false)
  const tipoBoxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!tipoBoxRef.current) return
      if (!tipoBoxRef.current.contains(e.target as Node)) {
        setTipoOpen(false)
      }
    }
    document.addEventListener("mousedown", onDocDown)
    return () => document.removeEventListener("mousedown", onDocDown)
  }, [])

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
      setErrorMsg(
        "Seu usuário não está vinculado a nenhuma loja (store_id). Verifique a tabela users_profile no Supabase."
      )
      return null
    }

    return data.store_id as string
  }

  async function loadProducts(currentStoreId: string) {
    setErrorMsg(null)
    setLoading(true)

    const { data, error } = await supabase
      .from("products")
      .select(
        "id, store_id, codigo, tipo, descricao, marca, fornecedor, preco, estoque_minimo, created_at"
      )
      .eq("store_id", currentStoreId)
      .order("codigo", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })

    if (error) {
      setProducts([])
      setErrorMsg(`Erro ao carregar produtos: ${error.message}`)
      setLoading(false)
      return
    }

    setProducts((data as Product[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    ;(async () => {
      const sid = await getStoreIdOrRedirect()
      if (!sid) {
        setLoading(false)
        setProducts([])
        return
      }
      setStoreId(sid)
      await loadProducts(sid)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tipoSuggestions = useMemo(() => {
    const set = new Set(products.map((p) => (p.tipo || "").trim()).filter(Boolean))
    const all = Array.from(set)
    const term = tipo.trim().toLowerCase()
    if (!term) return all.slice(0, 6)
    return all.filter((t) => t.toLowerCase().startsWith(term)).slice(0, 6)
  }, [products, tipo])

  const marcaSuggestions = useMemo(() => {
    const set = new Set<string>()
    for (const p of products) {
      const m = (p.marca || "").trim()
      if (m) set.add(m)
    }
    const list = Array.from(set).sort((a, b) => a.localeCompare(b))
    if (!list.includes("Outros")) list.unshift("Outros")
    return list
  }, [products])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    const bs = brandOrSupplier.trim().toLowerCase()

    return products.filter((p) => {
      const blob = [
        String(p.codigo ?? ""),
        p.tipo,
        p.descricao,
        p.marca ?? "",
        p.fornecedor ?? "",
      ]
        .join(" ")
        .toLowerCase()

      const matchesText = !term || blob.includes(term)

      const matchesBrandOrSupplier =
        !bs ||
        (p.marca ?? "").toLowerCase().includes(bs) ||
        (p.fornecedor ?? "").toLowerCase().includes(bs)

      return matchesText && matchesBrandOrSupplier
    })
  }, [products, q, brandOrSupplier])

  function parseMinValue(v: string): number | null {
    const t = (v || "").trim()
    if (!t || t === "-") return null
    const n = Number(t.replace(",", "."))
    if (!Number.isFinite(n)) return null
    return Math.max(0, Math.trunc(n))
  }

  async function onSaveNewProduct() {
    setErrorMsg(null)

    if (!storeId) {
      setErrorMsg("Não foi possível identificar sua loja (store_id).")
      return
    }

    const parsedPreco = Number((preco || "").replace(",", "."))
    const minFinal = parseMinValue(estoqueMinimo)

    if (!tipo.trim() || !descricao.trim() || !fornecedor.trim()) {
      alert("Preencha pelo menos: Tipo, Descrição e Fornecedor.")
      return
    }
    if (!Number.isFinite(parsedPreco)) {
      alert("Preço inválido.")
      return
    }

    setSaving(true)

    const { data: nextCode, error: rpcError } = await supabase.rpc(
      "next_product_codigo",
      { p_store_id: storeId }
    )

    if (rpcError) {
      setErrorMsg(`Erro ao gerar ID do produto: ${rpcError.message}`)
      setSaving(false)
      return
    }

    const codigo = Number(nextCode)
    if (!Number.isFinite(codigo)) {
      setErrorMsg("Erro ao gerar ID do produto: retorno inválido.")
      setSaving(false)
      return
    }

    const marcaFinalRaw = (marca || "").trim()
    const marcaFinal =
      !marcaFinalRaw || marcaFinalRaw.toLowerCase() === "outros"
        ? "Outros"
        : marcaFinalRaw

    const payload = {
      store_id: storeId,
      codigo: Math.trunc(codigo),
      tipo: tipo.trim(),
      descricao: descricao.trim(),
      marca: marcaFinal,
      fornecedor: fornecedor.trim() ? fornecedor.trim() : null,
      preco: parsedPreco,
      estoque_minimo: minFinal,
    }

    const { data, error } = await supabase
      .from("products")
      .insert(payload)
      .select(
        "id, store_id, codigo, tipo, descricao, marca, fornecedor, preco, estoque_minimo, created_at"
      )
      .single()

    if (error) {
      setErrorMsg(`Erro ao salvar: ${error.message}`)
      setSaving(false)
      return
    }

    setProducts((prev) => {
      const merged = [...prev, data as Product]
      merged.sort((a, b) => (a.codigo ?? 999999999) - (b.codigo ?? 999999999))
      return merged
    })

    setIsOpen(false)
    setTipo("")
    setDescricao("")
    setMarca("Outros")
    setFornecedor("")
    setPreco("")
    setEstoqueMinimo("-")
    setTipoOpen(false)
    setSaving(false)
  }

  async function updatePriceInline(id: string, newValue: string) {
    setErrorMsg(null)

    const parsed = Number(newValue.replace(",", "."))
    if (!Number.isFinite(parsed)) return

    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, preco: parsed } : p)))

    const { error } = await supabase
      .from("products")
      .update({ preco: parsed })
      .eq("id", id)

    if (error) {
      setErrorMsg(`Erro ao atualizar preço: ${error.message}`)
      if (storeId) loadProducts(storeId)
    }
  }

  async function updateMinInline(id: string, newValue: string) {
    setErrorMsg(null)

    const minFinal = parseMinValue(newValue)

    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, estoque_minimo: minFinal } : p))
    )

    const { error } = await supabase
      .from("products")
      .update({ estoque_minimo: minFinal })
      .eq("id", id)

    if (error) {
      setErrorMsg(`Erro ao atualizar estoque mínimo: ${error.message}`)
      if (storeId) loadProducts(storeId)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Produtos</h1>
          <p className="text-sm text-slate-600 mt-1">
            Cadastro base de itens. (Quantidade fica no Estoque.)
          </p>
        </div>

        <button
          onClick={() => setIsOpen(true)}
          className="h-11 px-5 rounded-2xl bg-[#22C55E] text-white text-sm font-semibold hover:brightness-95 w-full md:w-auto"
        >
          Novo Produto
        </button>
      </div>

      {errorMsg ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Buscar</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Digite: ID, tipo, descrição…"
            className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-800">
            Fornecedor ou Marca
          </span>
          <input
            value={brandOrSupplier}
            onChange={(e) => setBrandOrSupplier(e.target.value)}
            placeholder="Ex: Fornecedor ABC ou DogPlus"
            className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          />
        </label>

        <div className="rounded-2xl bg-[#EAF7FF] border border-black/5 p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Itens</div>
            <div className="text-xs text-slate-600">Filtrados / Total</div>
          </div>
          <div className="text-lg font-semibold text-slate-900">
            {filtered.length} / {products.length}
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">
            Produtos cadastrados
          </div>

          <button
            onClick={() => (storeId ? loadProducts(storeId) : null)}
            className="h-10 px-4 rounded-2xl bg-white border border-black/10 text-slate-900 text-sm font-semibold hover:bg-slate-50"
          >
            Atualizar
          </button>
        </div>

        {loading ? (
          <div className="px-5 py-6 text-sm text-slate-600">Carregando…</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm min-w-[1060px]">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">ID</th>
                  <th className="text-left font-semibold px-4 py-3">Tipo</th>
                  <th className="text-left font-semibold px-4 py-3">Descrição</th>
                  <th className="text-left font-semibold px-4 py-3">Marca</th>
                  <th className="text-left font-semibold px-4 py-3">Fornecedor</th>
                  <th className="text-right font-semibold px-4 py-3">Estoque mínimo</th>
                  <th className="text-right font-semibold px-4 py-3">Valor un.</th>
                </tr>
              </thead>

              <tbody className="bg-white">
                {filtered.length === 0 ? (
                  <tr className="border-t border-black/5">
                    <td className="px-4 py-5 text-slate-600" colSpan={7}>
                      Nenhum item encontrado. Clique em <b>Novo Produto</b> para cadastrar.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t border-black/5 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {p.codigo ?? "—"}
                      </td>

                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {p.tipo}
                      </td>

                      <td className="px-4 py-3 text-slate-800">{p.descricao}</td>

                      <td className="px-4 py-3 text-slate-800">
                        {p.marca || "Outros"}
                      </td>

                      <td className="px-4 py-3 text-slate-800">
                        {p.fornecedor || "—"}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <select
                          value={p.estoque_minimo === null ? "-" : String(p.estoque_minimo)}
                          onChange={(e) => updateMinInline(p.id, e.target.value)}
                          className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                        >
                          {MIN_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <input
                          defaultValue={formatMoney(p.preco)}
                          onBlur={(e) => updatePriceInline(p.id, e.target.value)}
                          className="w-[120px] text-right h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                          inputMode="decimal"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => (saving ? null : setIsOpen(false))}
          />

          <div className="absolute left-1/2 top-1/2 w-[94vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white border border-black/10 shadow-xl">
            <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
              <div>
                <div className="text-base font-semibold text-slate-900">
                  Novo Produto
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  O ID será gerado automaticamente (1,2,3…).
                </div>
              </div>
              <button
                onClick={() => (saving ? null : setIsOpen(false))}
                className="h-10 px-4 rounded-2xl bg-white border border-black/10 text-slate-900 text-sm font-semibold hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ✅ Tipo com dropdown que fecha */}
              <div ref={tipoBoxRef} className="relative">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Tipo *</span>
                  <input
                    value={tipo}
                    onChange={(e) => {
                      setTipo(e.target.value)
                      setTipoOpen(true)
                    }}
                    onFocus={() => setTipoOpen(true)}
                    placeholder="Ex: Ração"
                    className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                  />
                </label>

                {tipoOpen && tipoSuggestions.length > 0 ? (
                  <div className="absolute top-[78px] left-0 right-0 rounded-2xl bg-white border border-black/10 shadow-lg overflow-hidden z-10">
                    {tipoSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setTipo(s)
                          setTipoOpen(false)
                        }}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Marca</span>
                <input
                  list="marca-list"
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  placeholder="Escolha ou digite"
                  className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                />
                <datalist id="marca-list">
                  {marcaSuggestions.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </label>

              <label className="block md:col-span-2">
                <span className="text-sm font-semibold text-slate-800">Descrição *</span>
                <input
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Ração Premium 15kg"
                  className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-sm font-semibold text-slate-800">Fornecedor *</span>
                <input
                  value={fornecedor}
                  onChange={(e) => setFornecedor(e.target.value)}
                  placeholder="Ex: Fornecedor ABC"
                  className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Estoque mínimo</span>
                <select
                  value={estoqueMinimo}
                  onChange={(e) => setEstoqueMinimo(e.target.value)}
                  className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                >
                  {MIN_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-slate-500 mt-1">
                  Use “-” se não quiser controle por mínimo.
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Valor unitário *</span>
                <input
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                  placeholder="Ex: 89,90"
                  className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                  inputMode="decimal"
                />
              </label>
            </div>

            <div className="px-5 py-4 border-t border-black/5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => (saving ? null : setIsOpen(false))}
                className="h-11 px-5 rounded-2xl bg-white border border-black/10 text-slate-900 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                onClick={onSaveNewProduct}
                className="h-11 px-5 rounded-2xl bg-[#22C55E] text-white text-sm font-semibold hover:brightness-95 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar produto"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function formatMoney(n: number) {
  if (!Number.isFinite(n)) return "0,00"
  return n.toFixed(2).replace(".", ",")
}
