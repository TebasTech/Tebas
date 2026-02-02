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
  dateISO: string
  customerId: string
  codeStr: string
  descStr: string
  productId: string
  qtyStr: string
  unitPrice: number
  total: number
  receivedStr: string
  receivedTouched: boolean
  error: string
}

export default function VendasConsolidadaPage() {
  const router = useRouter()
  const firstDescRef = useRef<HTMLInputElement | null>(null)

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
      setTimeout(() => firstDescRef.current?.focus(), 80)
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

  const productOptions = useMemo(() => {
    return products.map((p) => {
      const label = `${p.descricao}${p.marca ? " • " + p.marca : ""} (${formatCodigo(p.codigo)})`
      return { id: p.id, label }
    })
  }, [products])

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

  function addRow(focus = true) {
    setRows((prev) => [...prev, newRow()])
    if (focus) setTimeout(() => focusLastDescription(), 50)
  }

  function focusLastDescription() {
    const el = document.querySelector<HTMLInputElement>('input[data-last="1"]')
    el?.focus()
  }

  function applyProductFromCode(row: Row, codeStr: string) {
    const code = parseCodigoStrict(codeStr)
    if (code === null) return { productId: "", unitPrice: 0, total: 0, descStr: "", error: "Use ID com asterisco. Ex: 1*" }

    const p = productsByCode.get(code)
    if (!p) return { productId: "", unitPrice: 0, total: 0, descStr: "", error: "ID não encontrado." }

    const qty = Math.max(0.001, toNumberBR(row.qtyStr))
    const total = round2((p.preco || 0) * qty)
    const descStr = `${p.descricao}${p.marca ? " • " + p.marca : ""} (${formatCodigo(p.codigo)})`

    return { productId: p.id, unitPrice: Number(p.preco || 0), total, descStr, error: "" }
  }

  function applyProductFromDesc(row: Row, descStr: string) {
    const opt = productOptions.find((o) => o.label === descStr)
    if (!opt) return { productId: "", unitPrice: 0, total: 0, codeStr: "", error: "" }

    const p = productsById.get(opt.id)
    if (!p) return { productId: "", unitPrice: 0, total: 0, codeStr: "", error: "Item inválido." }

    const qty = Math.max(0.001, toNumberBR(row.qtyStr))
    const total = round2((p.preco || 0) * qty)
    const codeStrFinal = formatCodigo(p.codigo)

    return { productId: p.id, unitPrice: Number(p.preco || 0), total, codeStr: codeStrFinal, error: "" }
  }

  function recalcRowTotal(productId: string, qtyStr: string) {
    const p = productsById.get(productId)
    if (!p) return { unitPrice: 0, total: 0 }
    const qty = Math.max(0.001, toNumberBR(qtyStr))
    return { unitPrice: Number(p.preco || 0), total: round2(Number(p.preco || 0) * qty) }
  }

  function applyTotalAndMaybeAutofillReceived(rowId: string, newTotal: number) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r
        const receivedStr = r.receivedTouched ? r.receivedStr : formatMoney(newTotal)
        return { ...r, total: newTotal, receivedStr }
      })
    )
  }

  function maybeAddRowOnEnter(e: React.KeyboardEvent, rowIndex: number) {
    if (e.key !== "Enter") return
    // Enter cria nova linha se for a última linha
    if (rowIndex === rows.length - 1) {
      e.preventDefault()
      addRow(true)
    }
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
      .filter((r) => r.codeStr.trim() || r.descStr.trim() || r.productId)

    if (cleaned.length === 0) {
      setErrorMsg("Adicione pelo menos 1 linha.")
      return
    }

    const validated: Row[] = []
    for (const r of cleaned) {
      let error = ""

      if (!r.dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(r.dateISO)) error = "Data inválida."

      let productId = r.productId
      if (!productId && r.codeStr.trim()) productId = applyProductFromCode(r, r.codeStr).productId
      if (!productId && r.descStr.trim()) productId = applyProductFromDesc(r, r.descStr).productId
      if (!productId) error = error || "Selecione um item (ID* ou descrição)."

      const qty = Math.max(0.001, toNumberBR(r.qtyStr))
      const inv = productId ? inventoryByProductId.get(productId) : null
      const stock = Number(inv?.quantidade ?? 0)
      if (productId && qty > stock) error = error || "Estoque insuficiente."

      if (error) {
        updateRow(r.id, { error })
      } else {
        const rr = recalcRowTotal(productId!, r.qtyStr)
        const received = r.receivedStr.trim() ? round2(toMoneyNumber(r.receivedStr)) : rr.total
        validated.push({
          ...r,
          productId: productId!,
          unitPrice: rr.unitPrice,
          total: rr.total,
          receivedStr: formatMoney(received),
          error: "",
        })
      }
    }

    if (validated.length !== cleaned.length) {
      setErrorMsg("Corrija as linhas marcadas em vermelho.")
      return
    }

    setSaving(true)

    let ok = 0
    for (const r of validated) {
      const createdAt = new Date(r.dateISO + "T12:00:00").toISOString()
      const received = round2(toMoneyNumber(r.receivedStr))

      const payload = {
        p_store_id: storeId,
        p_user_id: userId,
        p_payment: "Dinheiro",
        p_items: [
          {
            product_id: r.productId,
            qty: round3(Math.max(0.001, toNumberBR(r.qtyStr))),
            discount_pct: 0,
            total_final: r.total,
          },
        ],
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
    setTimeout(() => firstDescRef.current?.focus(), 80)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Vendas Consolidada</h1>
          <p className="text-sm text-slate-600 mt-1">
            Digite a descrição (lista) ou o ID*. Enter na última linha cria uma nova.
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
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>
      ) : null}

      {okMsg ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {okMsg} (Veja no histórico da página Vendas.)
        </div>
      ) : null}

      <section className="rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Lançamento rápido</div>

          <button
            onClick={() => addRow(true)}
            className="h-10 px-4 rounded-2xl bg-white border border-black/10 text-slate-900 text-sm font-semibold hover:bg-slate-50"
          >
            + Linha
          </button>
        </div>

        {loading ? (
          <div className="px-5 py-6 text-sm text-slate-600">Carregando…</div>
        ) : (
          <div className="overflow-auto">
            <datalist id="products-datalist">
              {productOptions.map((o) => (
                <option key={o.id} value={o.label} />
              ))}
            </datalist>

            <table className="w-full text-sm min-w-[1400px]">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Data</th>
                  <th className="text-left font-semibold px-4 py-3">Cliente</th>
                  <th className="text-left font-semibold px-4 py-3">Descrição</th>
                  <th className="text-left font-semibold px-4 py-3">ID</th>
                  <th className="text-right font-semibold px-4 py-3">Valor un.</th>
                  <th className="text-right font-semibold px-4 py-3">Qtde</th>
                  <th className="text-right font-semibold px-4 py-3">Valor total</th>
                  <th className="text-right font-semibold px-4 py-3">Valor recebido</th>
                  <th className="text-left font-semibold px-4 py-3">Ação</th>
                </tr>
              </thead>

              <tbody className="bg-white">
                {rows.map((r, idx) => {
                  const hasErr = Boolean(r.error)
                  const isLast = idx === rows.length - 1

                  return (
                    <tr
                      key={r.id}
                      className={`border-t border-black/5 ${hasErr ? "bg-red-50/40" : "hover:bg-slate-50/60"}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          value={r.dateISO}
                          onChange={(e) => updateRow(r.id, { dateISO: e.target.value, error: "" })}
                          onKeyDown={(e) => maybeAddRowOnEnter(e, idx)}
                          className="w-[150px] h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <select
                          value={r.customerId}
                          onChange={(e) => updateRow(r.id, { customerId: e.target.value, error: "" })}
                          onKeyDown={(e) => maybeAddRowOnEnter(e, idx)}
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
                          ref={idx === 0 ? firstDescRef : undefined}
                          data-last={isLast ? "1" : "0"}
                          list="products-datalist"
                          value={r.descStr}
                          onChange={(e) => {
                            const v = e.target.value
                            const patch = applyProductFromDesc(r, v)
                            const newTotal = patch.total

                            updateRow(r.id, {
                              descStr: v,
                              productId: patch.productId,
                              unitPrice: patch.unitPrice,
                              total: newTotal,
                              receivedStr: r.receivedTouched ? r.receivedStr : formatMoney(newTotal),
                              codeStr: patch.codeStr || r.codeStr,
                              error: patch.error || "",
                            })
                          }}
                          onKeyDown={(e) => maybeAddRowOnEnter(e, idx)}
                          className="w-[420px] h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                          placeholder="Digite a descrição e selecione..."
                        />
                        {r.error ? <div className="text-xs text-red-700 mt-1">{r.error}</div> : null}
                      </td>

                      <td className="px-4 py-3">
                        <input
                          value={r.codeStr}
                          onChange={(e) => {
                            const v = e.target.value
                            const patch = applyProductFromCode(r, v)
                            const newTotal = patch.total

                            updateRow(r.id, {
                              codeStr: v,
                              productId: patch.productId,
                              unitPrice: patch.unitPrice,
                              total: newTotal,
                              receivedStr: r.receivedTouched ? r.receivedStr : formatMoney(newTotal),
                              descStr: patch.descStr || r.descStr,
                              error: patch.error || "",
                            })
                          }}
                          onKeyDown={(e) => maybeAddRowOnEnter(e, idx)}
                          className="w-[92px] h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                          placeholder="1*"
                          inputMode="text"
                        />
                      </td>

                      <td className="px-4 py-3 text-right font-semibold text-slate-900">R$ {formatMoney(r.unitPrice)}</td>

                      <td className="px-4 py-3 text-right">
                        <input
                          value={r.qtyStr}
                          onChange={(e) => {
                            const v = e.target.value
                            const rr = r.productId ? recalcRowTotal(r.productId, v) : { unitPrice: 0, total: 0 }
                            updateRow(r.id, {
                              qtyStr: v,
                              unitPrice: rr.unitPrice,
                              total: rr.total,
                              receivedStr: r.receivedTouched ? r.receivedStr : formatMoney(rr.total),
                              error: "",
                            })
                          }}
                          onKeyDown={(e) => maybeAddRowOnEnter(e, idx)}
                          className="w-[92px] text-right h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                          placeholder="1,5"
                          inputMode="decimal"
                        />
                      </td>

                      <td className="px-4 py-3 text-right font-semibold text-slate-900">R$ {formatMoney(r.total)}</td>

                      <td className="px-4 py-3 text-right">
                        <input
                          value={r.receivedStr}
                          onChange={(e) => updateRow(r.id, { receivedStr: e.target.value, receivedTouched: true, error: "" })}
                          onKeyDown={(e) => maybeAddRowOnEnter(e, idx)}
                          className="w-[120px] text-right h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                          placeholder="0,00"
                          inputMode="decimal"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeRow(r.id)}
                          className="h-10 px-3 rounded-2xl bg-white border border-black/10 text-slate-900 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60"
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

            <div className="px-5 py-4 text-xs text-slate-500 border-t border-black/5">
              Dica: Enter na última linha cria uma nova (modo planilha).
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function newRow(): Row {
  const today = new Date()
  const yyyy = String(today.getFullYear())
  const mm = String(today.getMonth() + 1).padStart(2, "0")
  const dd = String(today.getDate()).padStart(2, "0")
  return {
    id: crypto.randomUUID(),
    dateISO: `${yyyy}-${mm}-${dd}`,
    customerId: "",
    codeStr: "",
    descStr: "",
    productId: "",
    qtyStr: "1",
    unitPrice: 0,
    total: 0,
    receivedStr: "",
    receivedTouched: false,
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

function formatCodigo(codigo: number | null) {
  if (codigo === null || codigo === undefined) return ""
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
  return round2(toNumberBR(v))
}

function formatMoney(n: number) {
  if (!Number.isFinite(n)) return "0,00"
  return n.toFixed(2).replace(".", ",")
}
