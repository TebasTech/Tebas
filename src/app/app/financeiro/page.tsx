"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"

type Product = {
  id: string
  store_id: string | null
  codigo: number | null
  descricao: string
  marca: string | null
  fornecedor: string | null
  ultimo_custo: number | null
}

type CashOutRow = {
  id: string
  store_id: string | null
  kind: "product" | "expense"
  out_date: string // YYYY-MM-DD
  descricao: string | null
  product_id: string | null
  quantidade: number
  valor_unitario: number
  valor_total: number
  created_at: string | null
  updated_at: string | null
}

export default function FinanceiroPage() {
  const router = useRouter()

  const [storeId, setStoreId] = useState<string | null>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [rows, setRows] = useState<CashOutRow[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [q, setQ] = useState("")
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d")

  const [isOpen, setIsOpen] = useState(false)

  // form
  const [kind, setKind] = useState<"product" | "expense">("expense")
  const [outDate, setOutDate] = useState<string>(() => todayISODate())

  // expense
  const [descExpense, setDescExpense] = useState("")

  // product (cruzado)
  const [codigoText, setCodigoText] = useState("") // aceita "12" ou "12*"
  const [productId, setProductId] = useState<string>("")
  const [productQuery, setProductQuery] = useState("") // busca por descrição/marca/fornecedor

  const [qtyText, setQtyText] = useState("1")
  const [unitText, setUnitText] = useState("0,00")
  const [totalText, setTotalText] = useState("0,00") // auto, mas editável

  // dropdowns
  const expenseBoxRef = useRef<HTMLDivElement | null>(null)
  const prodBoxRef = useRef<HTMLDivElement | null>(null)

  const [expenseOpen, setExpenseOpen] = useState(false)
  const [prodOpen, setProdOpen] = useState(false)

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      const t = e.target as Node
      if (expenseBoxRef.current && !expenseBoxRef.current.contains(t)) setExpenseOpen(false)
      if (prodBoxRef.current && !prodBoxRef.current.contains(t)) setProdOpen(false)
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
      setErrorMsg("Seu usuário não está vinculado a nenhuma loja (store_id).")
      return null
    }

    return data.store_id as string
  }

  function startOfDay(d: Date) {
    const x = new Date(d)
    x.setHours(0, 0, 0, 0)
    return x
  }

  function addDays(d: Date, days: number) {
    const x = new Date(d)
    x.setDate(x.getDate() + days)
    return x
  }

  function rangeStartISO(r: "7d" | "30d" | "90d") {
    const now = new Date()
    const days = r === "7d" ? 7 : r === "30d" ? 30 : 90
    return startOfDay(addDays(now, -(days - 1))).toISOString().slice(0, 10) // YYYY-MM-DD
  }

  async function loadAll(currentStoreId: string) {
    setErrorMsg(null)
    setLoading(true)

    const pRes = await supabase
      .from("products")
      .select("id, store_id, codigo, descricao, marca, fornecedor, ultimo_custo")
      .eq("store_id", currentStoreId)
      .order("codigo", { ascending: true, nullsFirst: false })

    if (pRes.error) {
      setProducts([])
      setRows([])
      setErrorMsg(`Erro ao carregar produtos: ${pRes.error.message}`)
      setLoading(false)
      return
    }

    const start = rangeStartISO(range)

    const rRes = await supabase
      .from("cash_out")
      .select("id, store_id, kind, out_date, descricao, product_id, quantidade, valor_unitario, valor_total, created_at, updated_at")
      .eq("store_id", currentStoreId)
      .gte("out_date", start)
      .order("out_date", { ascending: false })
      .order("created_at", { ascending: false })

    if (rRes.error) {
      setProducts((pRes.data as Product[]) ?? [])
      setRows([])
      setErrorMsg(`Erro ao carregar histórico: ${rRes.error.message}`)
      setLoading(false)
      return
    }

    setProducts((pRes.data as Product[]) ?? [])
    setRows((rRes.data as CashOutRow[]) ?? [])
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

  useEffect(() => {
    if (!storeId) return
    loadAll(storeId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range])

  const productsById = useMemo(() => {
    const m = new Map<string, Product>()
    for (const p of products) m.set(p.id, p)
    return m
  }, [products])

  const productsByCodigo = useMemo(() => {
    const m = new Map<number, Product>()
    for (const p of products) {
      if (p.codigo !== null && p.codigo !== undefined) m.set(Number(p.codigo), p)
    }
    return m
  }, [products])

  // Sugestões para DESPESA: usa histórico de despesas (sem produto)
  const expenseDescSuggestions = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      if (r.kind !== "expense") continue
      const t = (r.descricao || "").trim()
      if (t) set.add(t)
    }
    const all = Array.from(set).sort((a, b) => a.localeCompare(b))
    const term = descExpense.trim().toLowerCase()
    if (!term) return all.slice(0, 8)
    return all.filter((x) => x.toLowerCase().includes(term)).slice(0, 8)
  }, [rows, descExpense])

  // Sugestões de PRODUTO por texto (descrição/marca/fornecedor/codigo)
  const productSuggestions = useMemo(() => {
    const term = productQuery.trim().toLowerCase()
    const list = products.slice(0, 2000)
    const filtered = !term
      ? list
      : list.filter((p) => {
          const blob = [String(p.codigo ?? ""), p.descricao, p.marca ?? "", p.fornecedor ?? ""].join(" ").toLowerCase()
          return blob.includes(term)
        })
    return filtered.slice(0, 8)
  }, [products, productQuery])

  // Quando seleciona produto, sincroniza os campos e (se houver) puxa último custo
  useEffect(() => {
    if (!productId) return
    const p = productsById.get(productId)
    if (!p) return

    setProductQuery(`${p.descricao}${p.marca ? " • " + p.marca : ""}`)
    setCodigoText(p.codigo ? String(p.codigo) : "")

    if (p.ultimo_custo !== null && p.ultimo_custo !== undefined && p.ultimo_custo > 0) {
      setUnitText(formatMoney(p.ultimo_custo))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  // Se digitar código, tenta achar produto e preencher descrição automaticamente
  useEffect(() => {
    const raw = (codigoText || "").trim()
    if (!raw) return

    const cleaned = raw.replace("*", "").trim()
    const n = Number(cleaned)
    if (!Number.isFinite(n)) return

    const found = productsByCodigo.get(Math.trunc(n))
    if (found) {
      setProductId(found.id)
      setProdOpen(false)
    }
  }, [codigoText, productsByCodigo])

  // Regras de cálculo (total automático, mas editável)
  // - Se mudar QTD ou UNIT: recalcula TOTAL
  // - Se mudar TOTAL: recalcula UNIT (TOTAL / QTD)
  useEffect(() => {
    const qn = toQtyNumber(qtyText)
    const un = toMoneyNumber(unitText)
    const total = round2(qn * un)
    setTotalText(formatMoney(total))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qtyText, unitText])

  function onTotalEdited(newTotal: string) {
    setTotalText(newTotal)
    const qn = toQtyNumber(qtyText)
    const tot = toMoneyNumber(newTotal)
    if (qn > 0) {
      const un = round2(tot / qn)
      setUnitText(formatMoney(un))
    }
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return rows

    return rows.filter((r) => {
      const p = r.product_id ? productsById.get(r.product_id) : null
      const prodBlob = p ? [p.descricao, p.marca ?? "", p.fornecedor ?? "", String(p.codigo ?? "")].join(" ") : ""
      const blob = [r.out_date, r.descricao ?? "", prodBlob].join(" ").toLowerCase()
      return blob.includes(term)
    })
  }, [rows, q, productsById])

  const totals = useMemo(() => {
    const total = sum(filtered.map((r) => Number(r.valor_total) || 0))
    const count = filtered.length
    return { total, count }
  }, [filtered])

  function resetModal() {
    setKind("expense")
    setOutDate(todayISODate())
    setDescExpense("")
    setCodigoText("")
    setProductId("")
    setProductQuery("")
    setQtyText("1")
    setUnitText("0,00")
    setTotalText("0,00")
    setExpenseOpen(false)
    setProdOpen(false)
  }

  async function onSave() {
    setErrorMsg(null)
    if (!storeId) {
      setErrorMsg("Não foi possível identificar sua loja (store_id).")
      return
    }

    const d = (outDate || "").trim()
    if (!d) {
      alert("Selecione a data.")
      return
    }

    const qn = toQtyNumber(qtyText)
    const un = toMoneyNumber(unitText)
    const tot = toMoneyNumber(totalText)

    if (qn <= 0) {
      alert("Quantidade inválida.")
      return
    }

    let descricaoFinal = ""
    let pid: string | null = null

    if (kind === "expense") {
      descricaoFinal = (descExpense || "").trim()
      if (!descricaoFinal) {
        alert("Digite a descrição da despesa.")
        return
      }
    } else {
      if (!productId) {
        alert("Selecione o produto (por ID ou descrição).")
        return
      }
      const p = productsById.get(productId)
      if (!p) {
        alert("Produto inválido.")
        return
      }
      pid = p.id
      descricaoFinal = `Compra: ${p.descricao}${p.marca ? " • " + p.marca : ""}`
    }

    setSaving(true)

    const payload = {
      store_id: storeId,
      kind,
      out_date: d,
      descricao: descricaoFinal,
      product_id: pid,
      quantidade: qn,
      valor_unitario: un,
      valor_total: tot,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from("cash_out")
      .insert(payload)
      .select("id, store_id, kind, out_date, descricao, product_id, quantidade, valor_unitario, valor_total, created_at, updated_at")
      .single()

    if (error) {
      setErrorMsg(`Erro ao salvar: ${error.message}`)
      setSaving(false)
      return
    }

    // ✅ agora sempre entra na lista imediatamente
    setRows((prev) => [data as CashOutRow, ...prev])

    // Atualiza “último custo” localmente (a trigger também faz no banco)
    if (kind === "product" && productId) {
      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, ultimo_custo: un } : p)))
    }

    setIsOpen(false)
    resetModal()
    setSaving(false)
  }

  async function deleteRow(r: CashOutRow) {
    if (!storeId) return
    const ok = confirm("Remover este lançamento?")
    if (!ok) return

    setErrorMsg(null)

    const { error } = await supabase.from("cash_out").delete().eq("id", r.id).eq("store_id", storeId)

    if (error) {
      setErrorMsg(`Erro ao remover: ${error.message}`)
      return
    }

    setRows((prev) => prev.filter((x) => x.id !== r.id))
  }

  const selectedProduct = useMemo(() => {
    if (!productId) return null
    return productsById.get(productId) ?? null
  }, [productId, productsById])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-11 w-11 rounded-2xl bg-[#EAF7FF] border border-black/5 flex items-center justify-center">
            <IconWallet />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Compras & Despesas</h1>
            <p className="text-sm text-slate-600 mt-1">
              Despesas comuns você digita. Compras de produtos você seleciona pelo cadastro de Produtos.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as any)}
            className="h-11 px-4 rounded-2xl bg-white border border-black/10 text-slate-900 text-sm font-semibold hover:bg-slate-50 w-full sm:w-auto"
          >
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
          </select>

          <button
            onClick={() => {
              resetModal()
              setIsOpen(true)
            }}
            className="h-11 px-5 rounded-2xl bg-[#22C55E] text-white text-sm font-semibold hover:brightness-95 w-full sm:w-auto"
          >
            Nova saída
          </button>
        </div>
      </div>

      {errorMsg ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="block md:col-span-2">
          <span className="text-sm font-semibold text-slate-800">Buscar</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Digite: descrição, produto…"
            className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          />
        </label>

        <div className="rounded-2xl bg-[#EAF7FF] border border-black/5 p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Total</div>
            <div className="text-xs text-slate-600">Filtrados / lançamentos</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-slate-900">R$ {formatMoney(totals.total)}</div>
            <div className="text-xs text-slate-600">{totals.count} item(ns)</div>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-black/5">
          <div className="text-sm font-semibold text-slate-900">Histórico</div>
        </div>

        {loading ? (
          <div className="px-5 py-6 text-sm text-slate-600">Carregando…</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm min-w-[1180px]">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Data</th>
                  <th className="text-left font-semibold px-4 py-3">Tipo</th>
                  <th className="text-left font-semibold px-4 py-3">Descrição</th>
                  <th className="text-right font-semibold px-4 py-3">Quantidade</th>
                  <th className="text-right font-semibold px-4 py-3">Valor unit.</th>
                  <th className="text-right font-semibold px-4 py-3">Valor final</th>
                  <th className="text-left font-semibold px-4 py-3">Ações</th>
                </tr>
              </thead>

              <tbody className="bg-white">
                {filtered.length === 0 ? (
                  <tr className="border-t border-black/5">
                    <td className="px-4 py-5 text-slate-600" colSpan={7}>
                      Nenhum lançamento encontrado.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="border-t border-black/5 hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-800">{r.out_date}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                            r.kind === "product"
                              ? "bg-[#EAF7FF] text-slate-800 border-black/10"
                              : "bg-slate-50 text-slate-700 border-black/10"
                          }`}
                        >
                          {r.kind === "product" ? "Produto" : "Despesa"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-800">{r.descricao || "-"}</td>
                      <td className="px-4 py-3 text-right text-slate-800">{formatQty(r.quantidade)}</td>
                      <td className="px-4 py-3 text-right text-slate-800">R$ {formatMoney(r.valor_unitario)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">R$ {formatMoney(r.valor_total)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteRow(r)}
                          className="h-10 px-4 rounded-2xl bg-white border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50"
                        >
                          Remover
                        </button>
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
          <div className="absolute inset-0 bg-black/40" onClick={() => (saving ? null : setIsOpen(false))} />

          <div className="absolute left-1/2 top-1/2 w-[94vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white border border-black/10 shadow-xl">
            <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
              <div>
                <div className="text-base font-semibold text-slate-900">Nova saída</div>
                <div className="text-xs text-slate-600 mt-1">
                  Se for compra de produto, selecione o item do cadastro (por ID ou descrição).
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
                <span className="text-sm font-semibold text-slate-800">Data</span>
                <input
                  value={outDate}
                  onChange={(e) => setOutDate(e.target.value)}
                  className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                  type="date"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Tipo</span>
                <select
                  value={kind}
                  onChange={(e) => {
                    const v = e.target.value as any
                    setKind(v)
                    setDescExpense("")
                    setCodigoText("")
                    setProductId("")
                    setProductQuery("")
                    setExpenseOpen(false)
                    setProdOpen(false)
                  }}
                  className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                >
                  <option value="expense">Despesa (energia, aluguel, frete…)</option>
                  <option value="product">Compra de produto (do cadastro)</option>
                </select>
              </label>

              {kind === "expense" ? (
                <div ref={expenseBoxRef} className="relative">
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-800">Descrição *</span>
                    <input
                      value={descExpense}
                      onChange={(e) => {
                        setDescExpense(e.target.value)
                        setExpenseOpen(true)
                      }}
                      onFocus={() => setExpenseOpen(true)}
                      placeholder="Ex: Energia / Água / Aluguel / Frete"
                      className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                    />
                  </label>

                  {expenseOpen && expenseDescSuggestions.length > 0 ? (
                    <div className="absolute top-[78px] left-0 right-0 rounded-2xl bg-white border border-black/10 shadow-lg overflow-hidden z-10">
                      {expenseDescSuggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setDescExpense(s)
                            setExpenseOpen(false)
                          }}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-800">ID do produto</span>
                      <input
                        value={codigoText}
                        onChange={(e) => setCodigoText(e.target.value)}
                        placeholder='Ex: 12 ou 12*'
                        className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                        inputMode="numeric"
                      />
                      <div className="text-xs text-slate-500 mt-1">Dica: você pode digitar com * (ex: 12*).</div>
                    </label>

                    <div ref={prodBoxRef} className="relative">
                      <label className="block">
                        <span className="text-sm font-semibold text-slate-800">Descrição (lista)</span>
                        <input
                          value={productQuery}
                          onChange={(e) => {
                            setProductQuery(e.target.value)
                            setProdOpen(true)
                          }}
                          onFocus={() => setProdOpen(true)}
                          placeholder="Digite: descrição, marca, fornecedor…"
                          className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                        />
                      </label>

                      {prodOpen && productSuggestions.length > 0 ? (
                        <div className="absolute top-[78px] left-0 right-0 rounded-2xl bg-white border border-black/10 shadow-lg overflow-hidden z-10">
                          {productSuggestions.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setProductId(p.id)
                                setProdOpen(false)
                              }}
                              className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50"
                            >
                              <div className="font-semibold text-slate-900">
                                {p.codigo ? `${p.codigo}* ` : ""}{p.descricao}{p.marca ? ` • ${p.marca}` : ""}
                              </div>
                              <div className="text-xs text-slate-600 mt-0.5">
                                Fornecedor: {p.fornecedor || "-"} • Último custo: {p.ultimo_custo ? `R$ ${formatMoney(p.ultimo_custo)}` : "-"}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {selectedProduct ? (
                    <div className="rounded-2xl border border-black/10 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <div className="font-semibold text-slate-900">Selecionado</div>
                      <div className="mt-1">
                        {selectedProduct.codigo ? `${selectedProduct.codigo}* • ` : ""}{selectedProduct.descricao}
                        {selectedProduct.marca ? ` • ${selectedProduct.marca}` : ""} • Fornecedor: {selectedProduct.fornecedor || "-"}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Quantidade</span>
                  <input
                    value={qtyText}
                    onChange={(e) => setQtyText(e.target.value)}
                    placeholder="Ex: 1 ou 2,5"
                    className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                    inputMode="decimal"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Valor unitário</span>
                  <input
                    value={unitText}
                    onChange={(e) => setUnitText(e.target.value)}
                    placeholder="Ex: 89,90"
                    className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                    inputMode="decimal"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Valor total</span>
                  <input
                    value={totalText}
                    onChange={(e) => onTotalEdited(e.target.value)}
                    placeholder="Ex: 179,80"
                    className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                    inputMode="decimal"
                  />
                </label>
              </div>

              <div className="text-xs text-slate-600">
                Total é calculado automaticamente (qtd × unit), mas você pode editar o total e o sistema ajusta o unitário.
              </div>
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
                onClick={onSave}
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

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function sum(arr: number[]) {
  let t = 0
  for (const n of arr) t += Number.isFinite(n) ? n : 0
  return round2(t)
}

/** aceita vírgula como decimal */
function toNumberBR(v: string) {
  const t = String(v ?? "").trim()
  if (!t) return 0
  const norm = t.replace(/\./g, "").replace(",", ".")
  const n = Number(norm)
  if (!Number.isFinite(n)) return 0
  return n
}

function toMoneyNumber(v: string) {
  return round2(toNumberBR(v))
}

function toQtyNumber(v: string) {
  const n = toNumberBR(v)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.round(n * 1000) / 1000)
}

function formatMoney(n: number) {
  const x = Number.isFinite(n) ? n : 0
  return x.toFixed(2).replace(".", ",")
}

function formatQty(n: number) {
  const x = Number.isFinite(n) ? n : 0
  const s = x.toFixed(3)
  const trimmed = s.replace(/\.?0+$/, "")
  return trimmed.replace(".", ",")
}

function todayISODate() {
  const d = new Date()
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

function IconWallet() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M3 7h18v14H3V7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M3 7V5a2 2 0 0 1 2-2h14v4" stroke="currentColor" strokeWidth="2" />
      <path d="M17 13h4v4h-4a2 2 0 0 1 0-4Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}
