"use client"

import { useEffect, useMemo, useState } from "react"
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

type InventoryRow = {
  id: string
  store_id: string | null
  product_id: string
  quantidade: number
  unidade: string | null
  created_at: string | null
  updated_at: string | null
}

type StockItem = {
  product: Product
  inventory: InventoryRow | null
}

const UNIDADES = [
  { value: "un", label: "un (unidade)" },
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
  { value: "l", label: "litro" },
  { value: "ml", label: "ml" },
  { value: "saco", label: "saco" },
  { value: "pacote", label: "pacote" },
  { value: "caixa", label: "caixa" },
  { value: "fardo", label: "fardo" },
  { value: "lata", label: "lata" },
  { value: "pote", label: "pote" },
  { value: "m", label: "metro" },
]

export default function EstoquePage() {
  const router = useRouter()

  const [storeId, setStoreId] = useState<string | null>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [q, setQ] = useState("")
  const [brandOrSupplier, setBrandOrSupplier] = useState("")

  const [isOpen, setIsOpen] = useState(false)

  const [codigoSel, setCodigoSel] = useState<string>("")
  const [codigoStatus, setCodigoStatus] = useState<string>("") // ✅ novo

  const [marcaSel, setMarcaSel] = useState<string>("")
  const [produtoSel, setProdutoSel] = useState<string>("")
  const [quantidadeSel, setQuantidadeSel] = useState<string>("")
  const [unidadeSel, setUnidadeSel] = useState<string>("un")

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

  async function loadAll(currentStoreId: string) {
    setErrorMsg(null)
    setLoading(true)

    const pRes = await supabase
      .from("products")
      .select(
        "id, store_id, codigo, tipo, descricao, marca, fornecedor, preco, estoque_minimo, created_at"
      )
      .eq("store_id", currentStoreId)
      .order("codigo", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })

    if (pRes.error) {
      setProducts([])
      setInventory([])
      setErrorMsg(`Erro ao carregar products: ${pRes.error.message}`)
      setLoading(false)
      return
    }

    const iRes = await supabase
      .from("inventory")
      .select("id, store_id, product_id, quantidade, unidade, created_at, updated_at")
      .eq("store_id", currentStoreId)

    if (iRes.error) {
      setProducts(pRes.data as Product[])
      setInventory([])
      setErrorMsg(`Erro ao carregar inventory: ${iRes.error.message}`)
      setLoading(false)
      return
    }

    setProducts((pRes.data as Product[]) ?? [])
    setInventory((iRes.data as InventoryRow[]) ?? [])
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
      await loadAll(sid)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const marcas = useMemo(() => {
    const set = new Set<string>()
    for (const p of products) {
      const m = (p.marca || "").trim()
      if (m) set.add(m)
    }
    const list = Array.from(set).sort((a, b) => a.localeCompare(b))
    if (!list.includes("Outros")) list.unshift("Outros")
    return list
  }, [products])

  const productsById = useMemo(() => {
    const map = new Map<string, Product>()
    for (const p of products) map.set(p.id, p)
    return map
  }, [products])

  const inventoryByProductId = useMemo(() => {
    const map = new Map<string, InventoryRow>()
    for (const row of inventory) map.set(row.product_id, row)
    return map
  }, [inventory])

  const stockItems: StockItem[] = useMemo(() => {
    return products.map((p) => ({
      product: p,
      inventory: inventoryByProductId.get(p.id) ?? null,
    }))
  }, [products, inventoryByProductId])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    const bs = brandOrSupplier.trim().toLowerCase()

    return stockItems.filter((item) => {
      const p = item.product
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
  }, [stockItems, q, brandOrSupplier])

  function statusLabel(qtd: number, min: number | null) {
    if (min === null || min === undefined) {
      return {
        text: "Sem mínimo",
        cls: "bg-slate-100 text-slate-700 border-slate-200",
        level: "none" as const,
      }
    }

    if (min <= 0) {
      return {
        text: "Mínimo inválido",
        cls: "bg-slate-100 text-slate-700 border-slate-200",
        level: "none" as const,
      }
    }

    const extra = Math.ceil(min * 0.25)
    const limiteLaranja = min + extra

    if (qtd <= min) {
      return {
        text: `Crítico (≤ ${min})`,
        cls: "bg-red-50 text-red-700 border-red-200",
        level: "red" as const,
      }
    }

    if (qtd <= limiteLaranja) {
      return {
        text: `Atenção (≤ ${limiteLaranja})`,
        cls: "bg-amber-50 text-amber-800 border-amber-200",
        level: "orange" as const,
      }
    }

    return {
      text: "OK",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
      level: "green" as const,
    }
  }

  const alertCount = useMemo(() => {
    let n = 0
    for (const item of stockItems) {
      const qtd = item.inventory?.quantidade ?? 0
      const min = item.product.estoque_minimo
      const st = statusLabel(qtd, min)
      if (st.level === "red" || st.level === "orange") n++
    }
    return n
  }, [stockItems])

  const produtosFiltradosPorMarca = useMemo(() => {
    const m = (marcaSel || "").trim()
    if (!m) return products
    if (m === "Outros") {
      return products.filter((p) => {
        const pm = (p.marca || "").trim()
        return pm === "" || pm.toLowerCase() === "outros"
      })
    }
    return products.filter((p) => (p.marca || "").trim() === m)
  }, [products, marcaSel])

  useEffect(() => {
    const t = (codigoSel || "").trim()

    if (!t) {
      setCodigoStatus("")
      return
    }

    const code = Number(t)
    if (!Number.isFinite(code)) {
      setCodigoStatus("Digite apenas números.")
      return
    }

    const found = products.find((p) => p.codigo === Math.trunc(code))
    if (!found) {
      setCodigoStatus("ID não encontrado.")
      return
    }

    setCodigoStatus("")
    setProdutoSel(found.id)
    setMarcaSel((found.marca || "Outros").trim() || "Outros")
  }, [codigoSel, products])

  useEffect(() => {
    if (!produtoSel) return
    const p = productsById.get(produtoSel)
    if (!p) return
    if (p.codigo !== null && p.codigo !== undefined) {
      setCodigoSel(String(p.codigo))
    }
    setCodigoStatus("")
    setMarcaSel((p.marca || "Outros").trim() || "Outros")
  }, [produtoSel, productsById])

  async function onInsertItem() {
    setErrorMsg(null)
    if (!storeId) {
      setErrorMsg("Não foi possível identificar sua loja (store_id).")
      return
    }

    if (!produtoSel) {
      alert("Selecione o produto (ou digite o ID).")
      return
    }

    const parsedQtd = Number(String(quantidadeSel || "0").replace(",", "."))
    if (!Number.isFinite(parsedQtd)) {
      alert("Quantidade inválida.")
      return
    }
    const qtdNova = Math.max(0, Math.trunc(parsedQtd))

    const unidadeFinal = (unidadeSel || "un").trim() || "un"

    setSaving(true)

    const existing = inventoryByProductId.get(produtoSel)
    const qtdAtual = existing?.quantidade ?? 0
    const qtdFinal = qtdAtual + qtdNova

    const payload = {
      store_id: storeId,
      product_id: produtoSel,
      quantidade: qtdFinal,
      unidade: unidadeFinal,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from("inventory")
      .upsert(payload, { onConflict: "store_id,product_id" })
      .select("id, store_id, product_id, quantidade, unidade, created_at, updated_at")
      .single()

    if (error) {
      setErrorMsg(`Erro ao inserir/atualizar estoque: ${error.message}`)
      setSaving(false)
      return
    }

    setInventory((prev) => {
      const idx = prev.findIndex((r) => r.product_id === produtoSel)
      if (idx === -1) return [data as InventoryRow, ...prev]
      const copy = [...prev]
      copy[idx] = data as InventoryRow
      return copy
    })

    setIsOpen(false)
    setCodigoSel("")
    setCodigoStatus("")
    setMarcaSel("")
    setProdutoSel("")
    setQuantidadeSel("")
    setUnidadeSel("un")
    setSaving(false)
  }

  async function updateQtyInline(productId: string, newValue: string) {
    setErrorMsg(null)
    if (!storeId) return

    const parsed = Number(String(newValue || "0").replace(",", "."))
    if (!Number.isFinite(parsed)) return
    const qtdFinal = Math.max(0, Math.trunc(parsed))

    const existing = inventoryByProductId.get(productId)
    const unidadeAtual = (existing?.unidade || "un").trim() || "un"

    setInventory((prev) => {
      const idx = prev.findIndex((r) => r.product_id === productId)
      if (idx === -1) {
        return [
          {
            id: crypto.randomUUID(),
            store_id: storeId,
            product_id: productId,
            quantidade: qtdFinal,
            unidade: unidadeAtual,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          ...prev,
        ]
      }
      const copy = [...prev]
      copy[idx] = { ...copy[idx], quantidade: qtdFinal, updated_at: new Date().toISOString() }
      return copy
    })

    const { error } = await supabase
      .from("inventory")
      .upsert(
        {
          store_id: storeId,
          product_id: productId,
          quantidade: qtdFinal,
          unidade: unidadeAtual,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id,product_id" }
      )

    if (error) {
      setErrorMsg(`Erro ao atualizar quantidade: ${error.message}`)
      await loadAll(storeId)
    }
  }

  async function updateUnitInline(productId: string, newUnit: string) {
    setErrorMsg(null)
    if (!storeId) return

    const unidadeFinal = (newUnit || "un").trim() || "un"
    const existing = inventoryByProductId.get(productId)
    const qtdAtual = existing?.quantidade ?? 0

    setInventory((prev) => {
      const idx = prev.findIndex((r) => r.product_id === productId)
      if (idx === -1) {
        return [
          {
            id: crypto.randomUUID(),
            store_id: storeId,
            product_id: productId,
            quantidade: qtdAtual,
            unidade: unidadeFinal,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          ...prev,
        ]
      }
      const copy = [...prev]
      copy[idx] = { ...copy[idx], unidade: unidadeFinal, updated_at: new Date().toISOString() }
      return copy
    })

    const { error } = await supabase
      .from("inventory")
      .upsert(
        {
          store_id: storeId,
          product_id: productId,
          quantidade: qtdAtual,
          unidade: unidadeFinal,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id,product_id" }
      )

    if (error) {
      setErrorMsg(`Erro ao atualizar unidade: ${error.message}`)
      await loadAll(storeId)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-11 w-11 rounded-2xl bg-[#EAF7FF] border border-black/5 flex items-center justify-center">
            <IconBox />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Estoque</h1>
            <p className="text-sm text-slate-600 mt-1">
              Regra: qtd ≤ mínimo (vermelho), até mínimo + 25% (laranja), acima (verde).
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(true)}
          className="h-11 px-5 rounded-2xl bg-[#22C55E] text-white text-sm font-semibold hover:brightness-95 w-full md:w-auto"
        >
          Inserir item
        </button>
      </div>

      {errorMsg ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#EAF7FF] border border-black/5 flex items-center justify-center">
              <IconTruck />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Itens</div>
              <div className="text-xs text-slate-600">Total cadastrado</div>
            </div>
          </div>
          <div className="text-xl font-semibold text-slate-900">{products.length}</div>
        </div>

        <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
              <IconAlert />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Alerta</div>
              <div className="text-xs text-slate-600">Vermelho/Laranja</div>
            </div>
          </div>
          <div className="text-xl font-semibold text-slate-900">{alertCount}</div>
        </div>

        <div className="rounded-2xl bg-[#EAF7FF] border border-black/5 p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Filtrados</div>
            <div className="text-xs text-slate-600">Resultado / Total</div>
          </div>
          <div className="text-xl font-semibold text-slate-900">
            {filtered.length} / {products.length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Buscar</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Digite: ID, descrição, tipo…"
            className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Marca ou Fornecedor</span>
          <input
            value={brandOrSupplier}
            onChange={(e) => setBrandOrSupplier(e.target.value)}
            placeholder="Ex: Fornecedor ABC"
            className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          />
        </label>
      </div>

      <section className="rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Estoque atual</div>

          <button
            onClick={() => (storeId ? loadAll(storeId) : null)}
            className="h-10 px-4 rounded-2xl bg-white border border-black/10 text-slate-900 text-sm font-semibold hover:bg-slate-50"
          >
            Atualizar
          </button>
        </div>

        {loading ? (
          <div className="px-5 py-6 text-sm text-slate-600">Carregando…</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm min-w-[1120px]">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">ID</th>
                  <th className="text-left font-semibold px-4 py-3">Marca</th>
                  <th className="text-left font-semibold px-4 py-3">Produto</th>
                  <th className="text-left font-semibold px-4 py-3">Fornecedor</th>
                  <th className="text-right font-semibold px-4 py-3">Quantidade</th>
                  <th className="text-left font-semibold px-4 py-3">Grandeza</th>
                  <th className="text-right font-semibold px-4 py-3">Estoque mínimo</th>
                  <th className="text-left font-semibold px-4 py-3">Status</th>
                </tr>
              </thead>

              <tbody className="bg-white">
                {filtered.length === 0 ? (
                  <tr className="border-t border-black/5">
                    <td className="px-4 py-5 text-slate-600" colSpan={8}>
                      Nenhum item encontrado. Use <b>Inserir item</b> para lançar quantidade.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => {
                    const p = item.product
                    const inv = item.inventory
                    const qtd = inv?.quantidade ?? 0
                    const uni = (inv?.unidade || "un").trim() || "un"
                    const min = p.estoque_minimo
                    const st = statusLabel(qtd, min)

                    return (
                      <tr
                        key={p.id}
                        className="border-t border-black/5 hover:bg-slate-50/60"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {p.codigo ?? "—"}
                        </td>

                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {p.marca || "Outros"}
                        </td>

                        <td className="px-4 py-3 text-slate-800">
                          {p.descricao}
                          <div className="text-xs text-slate-500 mt-0.5">{p.tipo}</div>
                        </td>

                        <td className="px-4 py-3 text-slate-800">{p.fornecedor || "—"}</td>

                        <td className="px-4 py-3 text-right">
                          <input
                            defaultValue={String(qtd)}
                            onBlur={(e) => updateQtyInline(p.id, e.target.value)}
                            className="w-[110px] text-right h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                            inputMode="numeric"
                          />
                        </td>

                        <td className="px-4 py-3">
                          <select
                            value={uni}
                            onChange={(e) => updateUnitInline(p.id, e.target.value)}
                            className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                          >
                            {UNIDADES.map((u) => (
                              <option key={u.value} value={u.value}>
                                {u.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {min === null || min === undefined ? "—" : min}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${st.cls}`}
                          >
                            <span className="inline-block h-2 w-2 rounded-full bg-current opacity-70" />
                            {st.text}
                          </span>
                        </td>
                      </tr>
                    )
                  })
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
                  Inserir item no estoque
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  Digite o ID (opcional). Se existir, ele seleciona o produto automaticamente.
                </div>
              </div>

              <button
                onClick={() => (saving ? null : setIsOpen(false))}
                className="h-10 px-4 rounded-2xl bg-white border border-black/10 text-slate-900 text-sm font-semibold hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <div className="p-5 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">
                  ID do produto (opcional)
                </span>
                <input
                  value={codigoSel}
                  onChange={(e) => setCodigoSel(e.target.value)}
                  placeholder="Ex: 2"
                  className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                  inputMode="numeric"
                />
                {codigoStatus ? (
                  <div className="text-xs text-red-600 mt-2">{codigoStatus}</div>
                ) : null}
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Marca</span>
                  <select
                    value={marcaSel}
                    onChange={(e) => {
                      setMarcaSel(e.target.value)
                      setProdutoSel("")
                      setCodigoSel("")
                      setCodigoStatus("")
                    }}
                    className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                  >
                    <option value="">Todas</option>
                    {marcas.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Produto</span>
                  <select
                    value={produtoSel}
                    onChange={(e) => {
                      setProdutoSel(e.target.value)
                      setCodigoStatus("")
                    }}
                    className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                  >
                    <option value="">Selecione…</option>
                    {produtosFiltradosPorMarca.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.codigo ? `${p.codigo} - ${p.descricao}` : p.descricao}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Quantidade</span>
                  <input
                    value={quantidadeSel}
                    onChange={(e) => setQuantidadeSel(e.target.value)}
                    placeholder="Ex: 10"
                    className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                    inputMode="numeric"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Grandeza</span>
                  <select
                    value={unidadeSel}
                    onChange={(e) => setUnidadeSel(e.target.value)}
                    className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                  >
                    {UNIDADES.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {produtoSel ? (
                <div className="rounded-2xl border border-black/10 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <div className="font-semibold text-slate-900">Selecionado</div>
                  <div className="mt-1">
                    {(() => {
                      const p = productsById.get(produtoSel)
                      if (!p) return "—"
                      const atual = inventoryByProductId.get(produtoSel)?.quantidade ?? 0
                      const min = p.estoque_minimo
                      const minTxt = min === null || min === undefined ? "—" : String(min)
                      return `${p.codigo ?? "—"} • ${p.descricao} • Atual: ${atual} • Mínimo: ${minTxt}`
                    })()}
                  </div>
                </div>
              ) : null}
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
                onClick={onInsertItem}
                className="h-11 px-5 rounded-2xl bg-[#22C55E] text-white text-sm font-semibold hover:brightness-95 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
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

function IconTruck() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7h11v10H3z" />
      <path d="M14 10h4l3 3v4h-7z" />
      <path d="M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
      <path d="M17 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
    </svg>
  )
}

function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-amber-800" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.6 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
    </svg>
  )
}
