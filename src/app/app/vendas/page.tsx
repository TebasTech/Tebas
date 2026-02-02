"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
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

type Customer = {
  id: string
  store_id: string
  name: string
  phone: string | null
  created_at: string | null
}

type SaleRow = {
  id: string
  store_id: string
  sale_number: number
  created_at: string
  total: number
  payment_method: string | null
  received_total: number | null
  customer_id: string | null
  customer_name: string
  items_count: number
}

type CartLine = {
  product: Product
  qtyStr: string
  discountPctStr: string
  lineTotalStr: string
}

type SaleItemDetail = {
  product_id: string
  qty: number
  discount_pct: number
  total_final: number
  descricao: string
  marca: string | null
  codigo: number | null
}

const PAGAMENTOS = ["Dinheiro", "Cartão", "Pix"] as const

export default function VendasPage() {
  const router = useRouter()
  const codeRef = useRef<HTMLInputElement | null>(null)

  const [storeId, setStoreId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [history, setHistory] = useState<SaleRow[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [q, setQ] = useState("")
  const [codeInput, setCodeInput] = useState("")
  const [payment, setPayment] = useState<(typeof PAGAMENTOS)[number]>("Dinheiro")
  const [customerId, setCustomerId] = useState<string>("")

  const [cart, setCart] = useState<CartLine[]>([])
  const [lastSale, setLastSale] = useState<{ sale_number: number; received: number } | null>(null)

  // desconto geral (cruzado com valor recebido)
  const [overallDiscountPctStr, setOverallDiscountPctStr] = useState("0")
  const [receivedStr, setReceivedStr] = useState("0,00")
  const overallTouchedRef = useRef<"pct" | "received" | null>(null)

  // modal detalhes
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailSale, setDetailSale] = useState<SaleRow | null>(null)
  const [detailItems, setDetailItems] = useState<SaleItemDetail[]>([])

  async function getStoreIdOrRedirect(): Promise<{ storeId: string; userId: string } | null> {
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

    return { storeId: data.store_id as string, userId: user.id }
  }

  async function loadAll(currentStoreId: string) {
    setErrorMsg(null)
    setLoading(true)

    const pRes = await supabase
      .from("products")
      .select("id, store_id, codigo, tipo, descricao, marca, fornecedor, preco, estoque_minimo, created_at")
      .eq("store_id", currentStoreId)
      .order("codigo", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })

    const iRes = await supabase
      .from("inventory")
      .select("id, store_id, product_id, quantidade, unidade, created_at, updated_at")
      .eq("store_id", currentStoreId)

    const cRes = await supabase
      .from("customers")
      .select("id, store_id, name, phone, created_at")
      .eq("store_id", currentStoreId)
      .order("created_at", { ascending: false })
      .limit(300)

    const sRes = await supabase
      .from("sales")
      .select("id, store_id, sale_number, created_at, total, payment_method, received_total, customer_id")
      .eq("store_id", currentStoreId)
      .order("created_at", { ascending: false })
      .order("sale_number", { ascending: false })
      .limit(300)

    if (cRes.error) setErrorMsg(`Erro ao carregar customers: ${cRes.error.message}`)
    if (sRes.error) setErrorMsg(`Erro ao carregar sales (histórico): ${sRes.error.message}`)

    if (pRes.error) {
      setProducts([])
      setInventory([])
      setCustomers([])
      setHistory([])
      setErrorMsg(`Erro ao carregar products: ${pRes.error.message}`)
      setLoading(false)
      return
    }

    if (iRes.error) {
      setProducts((pRes.data as Product[]) ?? [])
      setInventory([])
      setCustomers([])
      setHistory([])
      setErrorMsg(`Erro ao carregar inventory: ${iRes.error.message}`)
      setLoading(false)
      return
    }

    const customersData = (cRes.error ? [] : (cRes.data as Customer[])) ?? []
    setCustomers(customersData)

    const salesData = (sRes.error ? [] : (sRes.data as any[])) ?? []

    const saleIds = salesData.map((s) => s.id)
    const itemsCountBySale = new Map<string, number>()

    if (saleIds.length > 0) {
      const itRes = await supabase.from("sale_items").select("sale_id").in("sale_id", saleIds)
      if (!itRes.error && Array.isArray(itRes.data)) {
        for (const r of itRes.data as any[]) {
          const sid = r.sale_id as string
          itemsCountBySale.set(sid, (itemsCountBySale.get(sid) ?? 0) + 1)
        }
      }
    }

    const customersById = new Map(customersData.map((c) => [c.id, c]))

    const mappedHistory: SaleRow[] = salesData.map((s) => {
      const cid = (s.customer_id as string | null) ?? null
      const cname = cid ? customersById.get(cid)?.name : null
      return {
        id: s.id,
        store_id: s.store_id,
        sale_number: Number(s.sale_number ?? 0),
        created_at: s.created_at,
        total: Number(s.total ?? 0),
        payment_method: s.payment_method ?? null,
        received_total: s.received_total === null || s.received_total === undefined ? null : Number(s.received_total),
        customer_id: cid,
        customer_name: cname ? cname : "Indefinido",
        items_count: itemsCountBySale.get(s.id) ?? 0,
      }
    })

    setHistory(mappedHistory)
    setProducts((pRes.data as Product[]) ?? [])
    setInventory((iRes.data as InventoryRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    ;(async () => {
      const r = await getStoreIdOrRedirect()
      if (!r) {
        setLoading(false)
        return
      }
      setStoreId(r.storeId)
      setUserId(r.userId)
      await loadAll(r.storeId)
      setTimeout(() => codeRef.current?.focus(), 80)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // atalhos teclado (não atrapalhar quando o usuário está digitando em inputs)
  useEffect(() => {
    function isTyping() {
      const el = document.activeElement as HTMLElement | null
      if (!el) return false
      return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT"
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault()
        if (saving) return
        finalizeSale()
        return
      }
      if (e.key === "F3") {
        e.preventDefault()
        if (saving) return
        clearCart()
        setTimeout(() => codeRef.current?.focus(), 0)
        return
      }
      if (e.key === "Enter") {
        // Enter no campo de ID adiciona rapidamente
        const active = document.activeElement
        if (active === codeRef.current) {
          e.preventDefault()
          tryAddByCodeOrSuggestion()
          return
        }
      }

      // evita atalhos atrapalhando inputs (exceto os casos acima)
      if (isTyping()) return
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving, codeInput, products, cart, storeId, userId, payment, customerId, overallDiscountPctStr, receivedStr])

  const inventoryByProductId = useMemo(() => {
    const map = new Map<string, InventoryRow>()
    for (const row of inventory) map.set(row.product_id, row)
    return map
  }, [inventory])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return products.slice(0, 80)

    return products
      .filter((p) => {
        const blob = [formatCodigo(p.codigo), p.tipo, p.descricao, p.marca ?? "", p.fornecedor ?? ""].join(" ").toLowerCase()
        return blob.includes(term)
      })
      .slice(0, 80)
  }, [products, q])

  const cartSubtotal = useMemo(() => {
    let t = 0
    for (const l of cart) t += toMoneyNumber(l.lineTotalStr)
    return round2(t)
  }, [cart])

  const overallPct = useMemo(() => clampPct(toNumberBR(overallDiscountPctStr)), [overallDiscountPctStr])

  const cartTotalFinal = useMemo(() => {
    const total = cartSubtotal * (1 - overallPct / 100)
    return round2(total)
  }, [cartSubtotal, overallPct])

  useEffect(() => {
    if (overallTouchedRef.current === "received") return
    setReceivedStr(formatMoney(cartTotalFinal))
  }, [cartTotalFinal])

  function addToCart(product: Product, qty: number) {
    setLastSale(null)

    setCart((prev) => {
      const idx = prev.findIndex((x) => x.product.id === product.id)
      if (idx === -1) {
        const base = round2((product.preco || 0) * qty)
        return [
          {
            product,
            qtyStr: formatQtyBR(qty),
            discountPctStr: "0",
            lineTotalStr: formatMoney(base),
          },
          ...prev,
        ]
      }

      const copy = [...prev]
      const old = copy[idx]
      const newQty = round3(toNumberBR(old.qtyStr) + qty)

      const base = round2((product.preco || 0) * newQty)
      const pct = clampPct(toNumberBR(old.discountPctStr))
      const total = round2(base * (1 - pct / 100))

      copy[idx] = { ...old, qtyStr: formatQtyBR(newQty), lineTotalStr: formatMoney(total) }
      return copy
    })
  }

  function setQtyStr(productId: string, v: string) {
    setCart((prev) =>
      prev.map((l) => {
        if (l.product.id !== productId) return l
        const qty = Math.max(0.001, toNumberBR(v))
        const base = round2((l.product.preco || 0) * qty)
        const pct = clampPct(toNumberBR(l.discountPctStr))
        const total = round2(base * (1 - pct / 100))
        return { ...l, qtyStr: v, lineTotalStr: formatMoney(total) }
      })
    )
  }

  function setDiscountPctStr(productId: string, v: string) {
    setCart((prev) =>
      prev.map((l) => {
        if (l.product.id !== productId) return l
        const qty = Math.max(0.001, toNumberBR(l.qtyStr))
        const base = round2((l.product.preco || 0) * qty)
        const pct = clampPct(toNumberBR(v))
        const total = round2(base * (1 - pct / 100))
        return { ...l, discountPctStr: v, lineTotalStr: formatMoney(total) }
      })
    )
  }

  function setLineTotalStr(productId: string, v: string) {
    setCart((prev) =>
      prev.map((l) => {
        if (l.product.id !== productId) return l
        const qty = Math.max(0.001, toNumberBR(l.qtyStr))
        const base = round2((l.product.preco || 0) * qty)
        const final = Math.max(0, toMoneyNumber(v))
        const pct = base > 0 ? clampPct(100 * (1 - final / base)) : 0
        return { ...l, discountPctStr: formatPctBR(pct), lineTotalStr: v }
      })
    )
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.product.id !== productId))
  }

  function clearCart() {
    setCart([])
    setLastSale(null)
    setOverallDiscountPctStr("0")
    setReceivedStr("0,00")
    overallTouchedRef.current = null
  }

  function parseCodigoFromInputStrict(raw: string): number | null {
    const t = (raw || "").trim()
    if (!t) return null
    if (!t.endsWith("*")) return null
    const numPart = t.slice(0, -1).trim()
    const n = Number(numPart)
    if (!Number.isFinite(n)) return null
    return Math.trunc(n)
  }

  const codeSuggestion = useMemo(() => {
    const t = codeInput.trim()
    if (!t) return null
    const digits = t.replace(/\D/g, "")
    if (!digits) return null
    const n = Number(digits)
    if (!Number.isFinite(n)) return null
    const p = products.find((x) => x.codigo === Math.trunc(n))
    if (!p) return null
    return p
  }, [codeInput, products])

  function pickSuggestion(p: Product) {
    setErrorMsg(null)
    addToCart(p, 1)
    setCodeInput("")
    setTimeout(() => codeRef.current?.focus(), 0)
  }

  function tryAddByCodeOrSuggestion() {
    // se existe sugestão, adiciona direto (rápido), mesmo sem asterisco
    if (codeSuggestion) {
      pickSuggestion(codeSuggestion)
      return
    }

    setErrorMsg(null)
    const code = parseCodigoFromInputStrict(codeInput)
    if (code === null) {
      setErrorMsg("Para evitar confusão, use o formato: 1* (com asterisco).")
      return
    }

    const p = products.find((x) => x.codigo === code)
    if (!p) {
      setErrorMsg("ID não encontrado.")
      return
    }

    addToCart(p, 1)
    setCodeInput("")
    setTimeout(() => codeRef.current?.focus(), 0)
  }

  function onChangeOverallPct(v: string) {
    overallTouchedRef.current = "pct"
    setOverallDiscountPctStr(v)
  }

  function onChangeReceived(v: string) {
    overallTouchedRef.current = "received"
    setReceivedStr(v)

    const received = toMoneyNumber(v)
    if (cartSubtotal <= 0) {
      setOverallDiscountPctStr("0")
      return
    }
    const pct = clampPct(100 * (1 - received / cartSubtotal))
    setOverallDiscountPctStr(formatPctBR(pct))
  }

  function onOverallPctBlur() {
    overallTouchedRef.current = null
    const pct = clampPct(toNumberBR(overallDiscountPctStr))
    setOverallDiscountPctStr(formatPctBR(pct))
  }

  function onReceivedBlur() {
    overallTouchedRef.current = null
    setReceivedStr(formatMoney(toMoneyNumber(receivedStr)))
  }

  async function finalizeSale() {
    setErrorMsg(null)

    if (!storeId || !userId) {
      setErrorMsg("Não foi possível identificar sua loja/usuário.")
      return
    }
    if (cart.length === 0) {
      setErrorMsg("Adicione pelo menos 1 item.")
      return
    }

    for (const l of cart) {
      const qty = Math.max(0.001, toNumberBR(l.qtyStr))
      const inv = inventoryByProductId.get(l.product.id)
      const stock = Number(inv?.quantidade ?? 0)
      if (qty > stock) {
        setErrorMsg(`Estoque insuficiente em: ${formatCodigo(l.product.codigo)} ${l.product.descricao}`)
        return
      }
    }

    setSaving(true)

    const items = cart.map((l) => ({
      product_id: l.product.id,
      qty: round3(Math.max(0.001, toNumberBR(l.qtyStr))),
      discount_pct: clampPct(toNumberBR(l.discountPctStr)),
      total_final: round2(toMoneyNumber(l.lineTotalStr)),
    }))

    const received = round2(toMoneyNumber(receivedStr))

    const { data, error } = await supabase.rpc("create_sale", {
      p_store_id: storeId,
      p_user_id: userId,
      p_payment: payment,
      p_items: items,
      p_customer_id: customerId ? customerId : null,
      p_discount_pct: overallPct,
      p_received_total: received,
      p_created_at: null,
    })

    if (error) {
      setErrorMsg(error.message)
      setSaving(false)
      return
    }

    const row = Array.isArray(data) ? data[0] : data
    const saleNumber = Number(row?.sale_number)
    setLastSale({ sale_number: Number.isFinite(saleNumber) ? saleNumber : 0, received })

    await loadAll(storeId)

    clearCart()
    setCodeInput("")
    setQ("")
    setCustomerId("")
    setTimeout(() => codeRef.current?.focus(), 80)
    setSaving(false)
  }

  async function openDetail(s: SaleRow) {
    if (!storeId) return
    setDetailSale(s)
    setDetailItems([])
    setDetailOpen(true)
    setDetailLoading(true)
    setErrorMsg(null)

    // carrega itens
    const itemsRes = await supabase
      .from("sale_items")
      .select("product_id, qty, discount_pct, total_final")
      .eq("sale_id", s.id)

    if (itemsRes.error) {
      setErrorMsg(`Erro ao carregar itens: ${itemsRes.error.message}`)
      setDetailLoading(false)
      return
    }

    const items = (itemsRes.data as any[]) ?? []
    const ids = items.map((x) => x.product_id).filter(Boolean)

    let prods: any[] = []
    if (ids.length > 0) {
      const prodRes = await supabase
        .from("products")
        .select("id, codigo, descricao, marca")
        .eq("store_id", storeId)
        .in("id", ids)

      if (!prodRes.error) prods = (prodRes.data as any[]) ?? []
    }

    const prodById = new Map(prods.map((p) => [p.id, p]))

    const mapped: SaleItemDetail[] = items.map((it) => {
      const p = prodById.get(it.product_id)
      return {
        product_id: it.product_id,
        qty: Number(it.qty ?? 0),
        discount_pct: Number(it.discount_pct ?? 0),
        total_final: Number(it.total_final ?? 0),
        descricao: p?.descricao ?? "—",
        marca: p?.marca ?? null,
        codigo: p?.codigo ?? null,
      }
    })

    setDetailItems(mapped)
    setDetailLoading(false)
  }

  function closeDetail() {
    setDetailOpen(false)
    setDetailSale(null)
    setDetailItems([])
  }

  async function deleteSale(saleId: string) {
    if (!storeId) return
    const ok = confirm("Remover esta venda e devolver ao estoque?")
    if (!ok) return

    setErrorMsg(null)

    const { error } = await supabase.rpc("revert_sale", {
      p_store_id: storeId,
      p_sale_id: saleId,
    })

    if (error) {
      setErrorMsg(`Erro ao estornar: ${error.message}`)
      return
    }

    await loadAll(storeId)
  }

  async function updateSaleInline(
    saleId: string,
    patch: Partial<{ customer_id: string | null; payment_method: string; received_total: number | null }>
  ) {
    if (!storeId) return
    setErrorMsg(null)

    const { error } = await supabase.from("sales").update(patch).eq("id", saleId).eq("store_id", storeId)
    if (error) {
      setErrorMsg(`Erro ao atualizar: ${error.message}`)
      await loadAll(storeId)
    } else {
      await loadAll(storeId)
    }
  }

  function exportCSV() {
    const rows = [...history].sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    const header = ["Data", "Venda", "Cliente", "Pagamento", "Itens", "Total", "Recebido"].join(";") + "\n"
    const lines = rows
      .map((s) => {
        return [
          formatDateTimeBR(s.created_at),
          String(s.sale_number),
          safeCsv(s.customer_name),
          safeCsv(s.payment_method ?? ""),
          String(s.items_count),
          formatMoney(s.total),
          s.received_total === null ? "" : formatMoney(s.received_total),
        ].join(";")
      })
      .join("\n")

    const blob = new Blob([header + lines], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "historico_vendas.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Vendas</h1>
          <p className="text-sm text-slate-600 mt-1">
            Cliente opcional. Para adicionar por ID use: <b>1*</b>. Atalhos: <b>F2</b> concluir, <b>F3</b> limpar.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            onClick={exportCSV}
            className="h-11 px-5 rounded-2xl bg-white border border-black/10 text-slate-900 text-sm font-semibold hover:bg-slate-50 w-full sm:w-auto"
          >
            Exportar Excel
          </button>

          <Link
            href="/app/vendas/consolidada"
            className="h-11 px-5 rounded-2xl bg-[#0B2A4A] text-white text-sm font-semibold hover:brightness-95 w-full sm:w-auto inline-flex items-center justify-center"
          >
            Consolidada
          </Link>
        </div>
      </div>

      {errorMsg ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>
      ) : null}

      {lastSale ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Venda <b>#{lastSale.sale_number}</b> finalizada. Recebido: <b>R$ {formatMoney(lastSale.received)}</b>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <section className="lg:col-span-3 rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-black/5 space-y-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Produtos</div>
              <div className="text-xs text-slate-600 mt-1">Clique no produto para adicionar no carrinho.</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Buscar</span>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Digite: ID*, descrição, tipo…"
                  className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                />
              </label>

              <div className="relative">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Adicionar por ID</span>
                  <div className="mt-2 flex gap-2">
                    <input
                      ref={codeRef}
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value)}
                      placeholder="Ex: 12*"
                      className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                      inputMode="text"
                    />
                    <button
                      onClick={tryAddByCodeOrSuggestion}
                      className="h-11 px-4 rounded-2xl bg-[#22C55E] text-white text-sm font-semibold hover:brightness-95"
                    >
                      Add
                    </button>
                  </div>
                </label>

                {codeSuggestion ? (
                  <div className="absolute left-0 right-0 mt-2 rounded-2xl bg-white border border-black/10 shadow-lg overflow-hidden z-20">
                    <button
                      type="button"
                      onClick={() => pickSuggestion(codeSuggestion)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50"
                    >
                      <div className="text-sm font-semibold text-slate-900">
                        {formatCodigo(codeSuggestion.codigo)} {codeSuggestion.descricao}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {codeSuggestion.marca || "Outros"} • R$ {formatMoney(codeSuggestion.preco)}
                      </div>
                    </button>
                  </div>
                ) : null}

                <div className="text-xs text-slate-500 mt-1">Dica: digite o ID e clique na sugestão para adicionar rápido.</div>
              </div>
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-slate-800">Cliente (opcional)</span>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
              >
                <option value="">Indefinido</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.phone ? ` • ${c.phone}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <div className="px-5 py-6 text-sm text-slate-600">Carregando…</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm min-w-[920px]">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="text-left font-semibold px-4 py-3">ID</th>
                    <th className="text-left font-semibold px-4 py-3">Produto</th>
                    <th className="text-right font-semibold px-4 py-3">Preço</th>
                    <th className="text-right font-semibold px-4 py-3">Em estoque</th>
                    <th className="text-left font-semibold px-4 py-3">Unid.</th>
                  </tr>
                </thead>

                <tbody className="bg-white">
                  {filtered.length === 0 ? (
                    <tr className="border-t border-black/5">
                      <td className="px-4 py-5 text-slate-600" colSpan={5}>
                        Nenhum produto encontrado.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p) => {
                      const inv = inventoryByProductId.get(p.id)
                      const qtd = Number(inv?.quantidade ?? 0)
                      const uni = (inv?.unidade || "un").trim() || "un"
                      return (
                        <tr
                          key={p.id}
                          className="border-t border-black/5 hover:bg-slate-50/60 cursor-pointer"
                          onClick={() => addToCart(p, 1)}
                          title="Clique para adicionar"
                        >
                          <td className="px-4 py-3 font-semibold text-slate-900">{formatCodigo(p.codigo)}</td>
                          <td className="px-4 py-3 text-slate-800">
                            <div className="font-semibold">{p.descricao}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {p.tipo} • {p.marca || "Outros"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">R$ {formatMoney(p.preco)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatQtyBR(qtd)}</td>
                          <td className="px-4 py-3 text-slate-800">{uni}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="lg:col-span-2 rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Carrinho</div>
              <div className="text-xs text-slate-600 mt-1">{cart.length} item(ns)</div>
            </div>

            <button
              onClick={() => {
                clearCart()
                setTimeout(() => codeRef.current?.focus(), 0)
              }}
              className="h-10 px-4 rounded-2xl bg-white border border-black/10 text-slate-900 text-sm font-semibold hover:bg-slate-50"
            >
              Limpar
            </button>
          </div>

          <div className="p-5 space-y-4">
            {cart.length === 0 ? (
              <div className="rounded-2xl border border-black/10 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                Clique em um produto para adicionar.
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((l) => {
                  const inv = inventoryByProductId.get(l.product.id)
                  const qtdStock = Number(inv?.quantidade ?? 0)
                  const uni = (inv?.unidade || "un").trim() || "un"

                  const qty = Math.max(0.001, toNumberBR(l.qtyStr))
                  const base = round2((l.product.preco || 0) * qty)
                  const low = qty > qtdStock

                  return (
                    <div key={l.product.id} className="rounded-2xl border border-black/10 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{l.product.descricao}</div>
                          <div className="text-xs text-slate-600 mt-1">
                            ID {formatCodigo(l.product.codigo)} • R$ {formatMoney(l.product.preco)} • Base: R$ {formatMoney(base)} • Estoque:{" "}
                            {formatQtyBR(qtdStock)} {uni}
                          </div>
                          {low ? (
                            <div className="text-xs text-red-600 mt-2">
                              Quantidade maior que o estoque. Ao finalizar, vai dar erro.
                            </div>
                          ) : null}
                        </div>

                        <button
                          onClick={() => removeLine(l.product.id)}
                          className="h-9 px-3 rounded-2xl bg-white border border-black/10 text-slate-900 text-xs font-semibold hover:bg-slate-50"
                          title="Remover"
                        >
                          Remover
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className="block">
                          <span className="text-xs font-semibold text-slate-800">Qtd ({uni})</span>
                          <input
                            value={l.qtyStr}
                            onChange={(e) => setQtyStr(l.product.id, e.target.value)}
                            className="mt-2 w-full text-right h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                            inputMode="decimal"
                            placeholder="Ex: 1,5"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-semibold text-slate-800">Desconto (%)</span>
                          <input
                            value={l.discountPctStr}
                            onChange={(e) => setDiscountPctStr(l.product.id, e.target.value)}
                            className="mt-2 w-full text-right h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                            inputMode="decimal"
                            placeholder="Ex: 10"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-semibold text-slate-800">Valor final</span>
                          <input
                            value={l.lineTotalStr}
                            onChange={(e) => setLineTotalStr(l.product.id, e.target.value)}
                            className="mt-2 w-full text-right h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                            inputMode="decimal"
                            placeholder="Ex: 89,90"
                          />
                        </label>
                      </div>

                      <div className="mt-3 text-sm font-semibold text-slate-900 text-right">
                        Item: R$ {formatMoney(toMoneyNumber(l.lineTotalStr))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="rounded-2xl bg-[#EAF7FF] border border-black/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Subtotal (itens)</div>
                <div className="text-lg font-semibold text-slate-900">R$ {formatMoney(cartSubtotal)}</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-800">Desconto geral (%)</span>
                  <input
                    value={overallDiscountPctStr}
                    onChange={(e) => onChangeOverallPct(e.target.value)}
                    onBlur={onOverallPctBlur}
                    className="mt-2 w-full text-right h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                    inputMode="decimal"
                    placeholder="Ex: 5"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-800">Valor recebido</span>
                  <input
                    value={receivedStr}
                    onChange={(e) => onChangeReceived(e.target.value)}
                    onBlur={onReceivedBlur}
                    className="mt-2 w-full text-right h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                    inputMode="decimal"
                    placeholder="Ex: 120,00"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Recebido</div>
                <div className="text-2xl font-semibold text-slate-900">R$ {formatMoney(toMoneyNumber(receivedStr))}</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-800">Pagamento</span>
                  <select
                    value={payment}
                    onChange={(e) => setPayment(e.target.value as any)}
                    className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                  >
                    {PAGAMENTOS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-end">
                  <button
                    onClick={finalizeSale}
                    disabled={saving || cart.length === 0}
                    className="h-11 w-full rounded-2xl bg-[#22C55E] text-white text-sm font-semibold hover:brightness-95 disabled:opacity-60"
                  >
                    {saving ? "Finalizando..." : "Concluir venda"}
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-600">
                Dica: <b>F2</b> conclui, <b>F3</b> limpa.
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Histórico de vendas</div>
            <div className="text-xs text-slate-600 mt-1">Clique numa venda para ver detalhes. Remover estorna o estoque.</div>
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-6 text-sm text-slate-600">Carregando…</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm min-w-[1220px]">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Data</th>
                  <th className="text-left font-semibold px-4 py-3">Venda</th>
                  <th className="text-left font-semibold px-4 py-3">Cliente</th>
                  <th className="text-right font-semibold px-4 py-3">Itens</th>
                  <th className="text-left font-semibold px-4 py-3">Pagamento</th>
                  <th className="text-right font-semibold px-4 py-3">Total</th>
                  <th className="text-right font-semibold px-4 py-3">Recebido</th>
                  <th className="text-left font-semibold px-4 py-3">Ações</th>
                </tr>
              </thead>

              <tbody className="bg-white">
                {history.length === 0 ? (
                  <tr className="border-t border-black/5">
                    <td className="px-4 py-5 text-slate-600" colSpan={8}>
                      Nenhuma venda registrada ainda.
                    </td>
                  </tr>
                ) : (
                  history.map((s) => (
                    <tr
                      key={s.id}
                      className="border-t border-black/5 hover:bg-slate-50/60 cursor-pointer"
                      onClick={() => openDetail(s)}
                      title="Clique para ver detalhes"
                    >
                      <td className="px-4 py-3 text-slate-800">{formatDateTimeBR(s.created_at)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">#{s.sale_number}</td>

                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={s.customer_id ?? ""}
                          onChange={(e) => updateSaleInline(s.id, { customer_id: e.target.value ? e.target.value : null })}
                          className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                        >
                          <option value="">Indefinido</option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{s.items_count}</td>

                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={s.payment_method ?? "Dinheiro"}
                          onChange={(e) => updateSaleInline(s.id, { payment_method: e.target.value })}
                          className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                        >
                          {PAGAMENTOS.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-4 py-3 text-right font-semibold text-slate-900">R$ {formatMoney(s.total)}</td>

                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <input
                          defaultValue={s.received_total === null ? "" : formatMoney(s.received_total)}
                          onBlur={(e) => {
                            const v = e.target.value.trim()
                            const n = v ? round2(toMoneyNumber(v)) : null
                            updateSaleInline(s.id, { received_total: n })
                          }}
                          className="w-[130px] text-right h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                          inputMode="decimal"
                          placeholder="—"
                        />
                      </td>

                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => deleteSale(s.id)}
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

            <div className="px-5 py-4 text-xs text-slate-500 border-t border-black/5">
              Observação: ao remover, o sistema faz estorno (devolve as quantidades ao estoque).
            </div>
          </div>
        )}
      </section>

      {detailOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={closeDetail} />
          <div className="absolute left-1/2 top-1/2 w-[94vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white border border-black/10 shadow-xl">
            <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
              <div>
                <div className="text-base font-semibold text-slate-900">
                  Detalhes da venda {detailSale ? `#${detailSale.sale_number}` : ""}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  {detailSale ? `${formatDateTimeBR(detailSale.created_at)} • ${detailSale.customer_name}` : "—"}
                </div>
              </div>

              <button
                onClick={closeDetail}
                className="h-10 px-4 rounded-2xl bg-white border border-black/10 text-slate-900 text-sm font-semibold hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <div className="p-5 space-y-4">
              {detailLoading ? (
                <div className="text-sm text-slate-600">Carregando itens…</div>
              ) : detailItems.length === 0 ? (
                <div className="rounded-2xl border border-black/10 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  Nenhum item encontrado.
                </div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm min-w-[820px]">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="text-left font-semibold px-4 py-3">ID</th>
                        <th className="text-left font-semibold px-4 py-3">Item</th>
                        <th className="text-right font-semibold px-4 py-3">Qtd</th>
                        <th className="text-right font-semibold px-4 py-3">Desc (%)</th>
                        <th className="text-right font-semibold px-4 py-3">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {detailItems.map((it, idx) => (
                        <tr key={idx} className="border-t border-black/5">
                          <td className="px-4 py-3 font-semibold text-slate-900">{formatCodigo(it.codigo)}</td>
                          <td className="px-4 py-3 text-slate-800">
                            <div className="font-semibold">{it.descricao}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{it.marca || "Outros"}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatQtyBR(it.qty)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatPctBR(it.discount_pct)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">R$ {formatMoney(it.total_final)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="rounded-2xl bg-[#EAF7FF] border border-black/5 p-4 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Total</div>
                <div className="text-xl font-semibold text-slate-900">
                  R$ {detailSale ? formatMoney(detailSale.total) : "0,00"}
                </div>
              </div>

              {detailSale?.received_total !== null && detailSale?.received_total !== undefined ? (
                <div className="rounded-2xl border border-black/10 bg-slate-50 px-4 py-3 text-sm text-slate-800 flex items-center justify-between">
                  <div className="font-semibold text-slate-900">Recebido</div>
                  <div className="font-semibold text-slate-900">R$ {formatMoney(detailSale.received_total)}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function safeCsv(s: string) {
  const t = (s ?? "").replace(/\r?\n/g, " ").trim()
  return t.replace(/;/g, ",")
}

function formatCodigo(codigo: number | null) {
  if (codigo === null || codigo === undefined) return "—"
  return `${codigo}*`
}

function round2(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function round3(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 1000) / 1000
}

function toNumberBR(v: string) {
  const t = String(v ?? "").trim()
  if (!t) return 0
  const norm = t.replace(/\./g, "").replace(",", ".")
  const n = Number(norm)
  if (!Number.isFinite(n)) return 0
  return n
}

function toMoneyNumber(v: string) {
  const n = toNumberBR(v)
  return round2(n)
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 100) return 100
  return n
}

function formatMoney(n: number) {
  if (!Number.isFinite(n)) return "0,00"
  return n.toFixed(2).replace(".", ",")
}

function formatPctBR(n: number) {
  if (!Number.isFinite(n)) return "0"
  const v = round2(n)
  if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v))
  return String(v).replace(".", ",")
}

function formatQtyBR(n: number) {
  if (!Number.isFinite(n)) return "0"
  const isInt = Math.abs(n - Math.round(n)) < 1e-9
  if (isInt) return String(Math.round(n))
  return n.toFixed(3).replace(".", ",").replace(/0+$/, "").replace(/,$/, "")
}

function formatDateTimeBR(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, "0")
  const mi = String(d.getMinutes()).padStart(2, "0")
  return `${dd}/${mm}/${yy} ${hh}:${mi}`
}
