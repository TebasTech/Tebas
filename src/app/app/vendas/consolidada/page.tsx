"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"

type Product = {
  id: string
  store_id: string | null
  codigo: number | null
  descricao: string
  marca: string | null
  preco: number
}

type InventoryRow = {
  store_id: string | null
  product_id: string
  quantidade: number
  unidade: string | null
}

type Customer = {
  id: string
  store_id: string
  name: string
  phone: string | null
}

type Row = {
  id: string
  dateStr: string // "dd/mm/aaaa"
  customerId: string // "" = indefinido
  customerText: string // para busca rápida (aceita "i" -> Indefinido)
  codeStr: string // "1*"
  productId: string
  qtyStr: string // decimal BR
  unitPrice: number
  total: number
  receivedStr: string // BR money
  error: string
}

export default function VendasConsolidadaPage() {
  const router = useRouter()
  const firstCodeRef = useRef<HTMLInputElement | null>(null)

  const [storeId, setStoreId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  const [rows, setRows] = useState<Row[]>(() => [newRow()])

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

  useEffect(() => {
    ;(async () => {
      const r = await getStoreIdOrRedirect()
      if (!r) {
        setLoading(false)
        return
      }
      setStoreId(r.storeId)
      setUserId(r.userId)

      const pRes = await supabase
        .from("products")
        .select("id, store_id, codigo, descricao, marca, preco")
        .eq("store_id", r.storeId)
        .order("codigo", { ascending: true, nullsFirst: false })

      const iRes = await supabase
        .from("inventory")
        .select("store_id, product_id, quantidade, unidade")
        .eq("store_id", r.storeId)

      const cRes = await supabase
        .from("customers")
        .select("id, store_id, name, phone")
        .eq("store_id", r.storeId)
        .order("created_at", { ascending: false })
        .limit(300)

      setProducts((pRes.data as Product[]) ?? [])
      setInventory((iRes.data as InventoryRow[]) ?? [])
      setCustomers((cRes.data as Customer[]) ?? [])

      setLoading(false)
      setTimeout(() => firstCodeRef.current?.focus(), 80)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const inventoryByProductId = useMemo(() => {
    const map = new Map<string, InventoryRow>()
    for (const r of inventory) map.set(r.product_id, r)
    return map
  }, [inventory])

  const productsByCode = useMemo(() => {
    const map = new Map<number, Product>()
    for (const p of products) {
      if (p.codigo !== null && p.codigo !== undefined) map.set(p.codigo, p)
    }
    return map
  }, [products])

  const productsById = useMemo(() => {
    const map = new Map<string, Product>()
    for (const p of products) map.set(p.id, p)
    return map
  }, [products])

  const customersById = useMemo(() => {
    const map = new Map<string, Customer>()
    for (const c of customers) map.set(c.id, c)
    return map
  }, [customers])

  const customerOptions = useMemo(() => {
    return [
      { id: "", label: "Indefinido" },
      ...customers.map((c) => ({
        id: c.id,
        label: c.phone ? `${c.name} • ${c.phone}` : c.name,
      })),
    ]
  }, [customers])

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()])
  }

  function applyProductFromCode(r: Row, codeStr: string) {
    const code = parseCodigoStrict(codeStr)
    if (code === null) return { productId: "", unitPrice: 0, total: 0, error: "Use ID com asterisco. Ex: 1*" }

    const p = productsByCode.get(code)
    if (!p) return { productId: "", unitPrice: 0, total: 0, error: "ID não encontrado." }

    const qty = Math.max(0.001, toNumberBR(r.qtyStr))
    const total = round2((p.preco || 0) * qty)

    return { productId: p.id, unitPrice: Number(p.preco || 0), total, error: "" }
  }

  function recalcRowTotal(r: Row, productId: string, qtyStr: string) {
    const p = productsById.get(productId)
    if (!p) return { unitPrice: 0, total: 0 }
    const qty = Math.max(0.001, toNumberBR(qtyStr))
    return { unitPrice: Number(p.preco || 0), total: round2(Number(p.preco || 0) * qty) }
  }

  async function saveAll() {
    setErrorMsg(null)
    setOkMsg(null)

    if (!storeId || !userId) {
      setErrorMsg("Não foi possível identificar sua loja/usuário.")
      return
    }

    const cleaned = rows
      .map((r) => ({ ...r, error: "" }))
      .filter((r) => r.codeStr.trim() || r.productId)

    if (cleaned.length === 0) {
      setErrorMsg("Adicione pelo menos 1 linha.")
      return
    }

    // validação local (estoque, data, produto)
    const validated: Row[] = []
    for (const r of cleaned) {
      const patch: Partial<Row> = {}
      const dateIso = parseDateBRToISO(r.dateStr)
      if (!dateIso) patch.error = "Data inválida (use dd/mm/aaaa)."

      const productId = r.productId || applyProductFromCode(r, r.codeStr).productId
      if (!productId) patch.error = patch.error ? patch.error : "Item inválido."

      const p = productId ? productsById.get(productId) : null
      const qty = Math.max(0.001, toNumberBR(r.qtyStr))
      const inv = productId ? inventoryByProductId.get(productId) : null
      const stock = Number(inv?.quantidade ?? 0)

      if (p && qty > stock) patch.error = patch.error ? patch.error : "Estoque insuficiente."

      if (patch.error) {
        updateRow(r.id, patch)
      } else {
        const { unitPrice, total } = recalcRowTotal(r, productId, r.qtyStr)
        validated.push({
          ...r,
          productId,
          unitPrice,
          total,
          error: "",
          dateStr: r.dateStr.trim(),
        })
      }
    }

    if (validated.length !== cleaned.length) {
      setErrorMsg("Corrija as linhas marcadas em vermelho.")
      return
    }

    setSaving(true)

    // salva uma venda por linha (rápido para lançar caderno/whatsapp)
    let ok = 0
    for (const r of validated) {
      const dateIso = parseDateBRToISO(r.dateStr)!
      const createdAt = new Date(dateIso + "T12:00:00").toISOString() // meio-dia para evitar bug de fuso na hora

      const received = r.receivedStr.trim() ? round2(toMoneyNumber(r.receivedStr)) : null

      const payload = {
        p_store_id: storeId,
        p_user_id: userId,
        p_payment: "Dinheiro",
        p_items: [{ product_id: r.productId, qty: round3(Math.max(0.001, toNumberBR(r.qtyStr))), discount_pct: 0, line_total: r.total }],
        p_customer_id: r.customerId ? r.customerId : null,
        p_discount_pct: 0,
        p_received_total: received,
        p_created_at: createdAt,
      }

      const { error } = await supabase.rpc("create_sale", payload)
      if (error) {
        updateRow(r.id, { error: error.message })
        setSaving(false)
        setErrorMsg("Uma linha falhou. Veja o erro marcado e tente salvar de novo.")
        return
      }
      ok++
    }

    setSaving(false)
    setOkMsg(`${ok} venda(s) registrada(s).`)
    setRows([newRow()])
    setTimeout(() => firstCodeRef.current?.focus(), 80)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Vendas Consolidada</h1>
          <p className="text-sm text-slate-600 mt-1">
            Para lançar vendas rápidas depois (caderno/WhatsApp). Cada linha vira uma venda no histórico e baixa o estoque.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/app/vendas"
            className="h-11 px-5 rounded-2xl bg-white border border-black/10 text-slate-900 text-sm font-semibold hover:bg-slate-50 inline-flex items-center justify-center"
          >
            Voltar
          </Link>

          <button
            onClick={saveAll}
            disabled={saving || loading}
            className="h-11 px-5 rounded-2xl bg-[#22C55E] text-white text-sm font-semibold hover:brightness-95 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {errorMsg ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      {okMsg ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {okMsg}
        </div>
      ) : null}

      <section className="rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Lançamento rápido</div>

          <button
            onClick={addRow}
            className="h-10 px-4 rounded-2xl bg-white border border-black/10 text-slate-900 text-sm font-semibold hover:bg-slate-50"
          >
            + Linha
          </button>
        </div>

        {loading ? (
          <div className="px-5 py-6 text-sm text-slate-600">Carregando…</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm min-w-[1200px]">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Data</th>
                  <th className="text-left font-semibold px-4 py-3">Cliente</th>
                  <th className="text-left font-semibold px-4 py-3">ID</th>
                  <th className="text-left font-semibold px-4 py-3">Item</th>
                  <th className="text-right font-semibold px-4 py-3">Valor un.</th>
                  <th className="text-right font-semibold px-4 py-3">Qtde</th>
                  <th className="text-right font-semibold px-4 py-3">Valor total</th>
                  <th className="text-right font-semibold px-4 py-3">Valor recebido</th>
                  <th className="text-left font-semibold px-4 py-3">Ação</th>
                </tr>
              </thead>

              <tbody className="bg-white">
                {rows.map((r, idx) => {
                  const p = r.productId ? productsById.get(r.productId) : null
                  const displayItem = p ? `${p.descricao}${p.marca ? " • " + p.marca : ""}` : "—"
                  const inv = r.productId ? inventoryByProductId.get(r.productId) : null
                  const uni = (inv?.unidade || "un").trim() || "un"

                  const hasErr = Boolean(r.error)

                  return (
                    <tr key={r.id} className={`border-t border-black/5 ${hasErr ? "bg-red-50/40" : "hover:bg-slate-50/60"}`}>
                      <td className="px-4 py-3">
                        <input
                          value={r.dateStr}
                          onChange={(e) => updateRow(r.id, { dateStr: e.target.value, error: "" })}
                          className="w-[130px] h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                          placeholder="02/02/2026"
                          inputMode="numeric"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <select
                          value={r.customerId}
                          onChange={(e) => updateRow(r.id, { customerId: e.target.value, error: "" })}
                          className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                        >
                          {customerOptions.map((c) => (
                            <option key={c.id || "indef"} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-4 py-3">
                        <input
                          ref={idx === 0 ? firstCodeRef : undefined}
                          value={r.codeStr}
                          onChange={(e) => {
                            const v = e.target.value
                            const patch = applyProductFromCode(r, v)
                            updateRow(r.id, {
                              codeStr: v,
                              productId: patch.productId,
                              unitPrice: patch.unitPrice,
                              total: patch.total,
                              error: patch.error,
                            })
                          }}
                          className="w-[92px] h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                          placeholder="1*"
                          inputMode="text"
                        />
                      </td>

                      <td className="px-4 py-3 text-slate-800">
                        <div className="font-semibold">{displayItem}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{uni}</div>
                        {r.error ? <div className="text-xs text-red-700 mt-1">{r.error}</div> : null}
                      </td>

                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        R$ {formatMoney(r.unitPrice)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <input
                          value={r.qtyStr}
                          onChange={(e) => {
                            const v = e.target.value
                            const qty = Math.max(0.001, toNumberBR(v))
                            const rr = r.productId ? recalcRowTotal(r, r.productId, v) : { unitPrice: 0, total: 0 }
                            updateRow(r.id, {
                              qtyStr: v,
                              unitPrice: rr.unitPrice,
                              total: rr.total,
                              error: "",
                            })
                          }}
                          className="w-[92px] text-right h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                          placeholder="1,5"
                          inputMode="decimal"
                        />
                      </td>

                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        R$ {formatMoney(r.total)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <input
                          value={r.receivedStr}
                          onChange={(e) => updateRow(r.id, { receivedStr: e.target.value, error: "" })}
                          className="w-[120px] text-right h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                          placeholder="0,00"
                          inputMode="decimal"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeRow(r.id)}
                          className="h-10 px-3 rounded-2xl bg-white border border-black/10 text-slate-900 text-xs font-semibold hover:bg-slate-50"
                          disabled={rows.length === 1}
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function newRow(): Row {
  const today = new Date()
  const dd = String(today.getDate()).padStart(2, "0")
  const mm = String(today.getMonth() + 1).padStart(2, "0")
  const yy = today.getFullYear()
  return {
    id: crypto.randomUUID(),
    dateStr: `${dd}/${mm}/${yy}`,
    customerId: "",
    customerText: "",
    codeStr: "",
    productId: "",
    qtyStr: "1",
    unitPrice: 0,
    total: 0,
    receivedStr: "",
    error: "",
  }
}

function parseCodigoStrict(raw: string): number | null {
  const t = (raw || "").trim()
  if (!t) return null
  if (!t.endsWith("*")) return null
  const numPart = t.slice(0, -1).trim()
  const n = Number(numPart)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
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
  return round2(toNumberBR(v))
}

function formatMoney(n: number) {
  if (!Number.isFinite(n)) return "0,00"
  return n.toFixed(2).replace(".", ",")
}

function parseDateBRToISO(v: string) {
  const t = (v || "").trim()
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t)
  if (!m) return null
  const dd = Number(m[1])
  const mm = Number(m[2])
  const yy = Number(m[3])
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yy)) return null
  if (mm < 1 || mm > 12) return null
  if (dd < 1 || dd > 31) return null
  return `${String(yy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`
}
