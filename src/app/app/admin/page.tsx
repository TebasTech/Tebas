// src/app/app/admin/page.tsx
"use client"

// ✅ Área Admin Tebas (visão global)
// - Lista lojas
// - Filtro por nome
// - Resumo do dia (vendas, receita, despesas)
// - Detalhe por loja (últimas vendas + estoque em alerta)
// Requer: SQL de admin policies (is_admin + admin_all policies)

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"

type Store = { id: string; name: string }
type SalesAgg = { store_id: string; n: number; total: number }
type CashAgg = { store_id: string; n: number; total: number }

type ProductRow = {
  id: string
  store_id: string | null
  codigo: number | null
  tipo: string
  descricao: string
  marca: string | null
  fornecedor: string | null
  preco: number
  estoque_minimo: number | null
}

type InventoryRow = {
  product_id: string
  quantidade: number
  unidade: string | null
}

type SaleRow = {
  id: string
  store_id: string | null
  created_at: string | null
  customer_name: string | null
  total_final: number | null
  payment_method: string | null
}

export default function AdminPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [isAdmin, setIsAdmin] = useState<boolean>(false)

  const [stores, setStores] = useState<Store[]>([])
  const [salesAgg, setSalesAgg] = useState<Map<string, SalesAgg>>(new Map())
  const [cashAgg, setCashAgg] = useState<Map<string, CashAgg>>(new Map())

  const [q, setQ] = useState("")
  const [dateISO, setDateISO] = useState(() => todayISO())

  const [openStoreId, setOpenStoreId] = useState<string | null>(null)

  const [detailLoading, setDetailLoading] = useState(false)
  const [detailProducts, setDetailProducts] = useState<ProductRow[]>([])
  const [detailInventory, setDetailInventory] = useState<InventoryRow[]>([])
  const [detailSales, setDetailSales] = useState<SaleRow[]>([])

  async function getProfileOrRedirect(): Promise<{ store_id: string; role: string } | null> {
    setErrorMsg(null)
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) {
      router.push("/login")
      return null
    }

    const { data, error } = await supabase
      .from("users_profile")
      .select("store_id, role")
      .eq("id", user.id)
      .single()

    if (error) {
      setErrorMsg(`Erro ao carregar perfil: ${error.message}`)
      return null
    }
    if (!data?.store_id) {
      setErrorMsg("Seu usuário não está vinculado a nenhuma loja (store_id).")
      return null
    }
    return { store_id: String(data.store_id), role: String(data.role || "") }
  }

  async function loadOverview() {
    setLoading(true)
    setErrorMsg(null)

    const profile = await getProfileOrRedirect()
    if (!profile) {
      setLoading(false)
      return
    }

    const admin = String(profile.role || "").toLowerCase() === "admin"
    setIsAdmin(admin)
    if (!admin) {
      router.replace("/app/loja")
      setLoading(false)
      return
    }

    const { data: storeRows, error: sErr } = await supabase
      .from("stores")
      .select("id, name")
      .order("name", { ascending: true })

    if (sErr) {
      setErrorMsg(`Erro ao carregar lojas: ${sErr.message}`)
      setLoading(false)
      return
    }

    setStores((storeRows as Store[]) ?? [])

    const start = dateISO + "T00:00:00.000Z"
    const end = dateISO + "T23:59:59.999Z"

    const salesRes = await supabase
      .from("sales")
      .select("store_id, total_final, created_at")
      .gte("created_at", start)
      .lte("created_at", end)

    if (salesRes.error) {
      setErrorMsg(`Erro ao carregar vendas: ${salesRes.error.message}`)
      setLoading(false)
      return
    }

    const cashRes = await supabase
      .from("cash_out")
      .select("store_id, amount_total, created_at")
      .gte("created_at", start)
      .lte("created_at", end)

    if (cashRes.error) {
      setErrorMsg(`Erro ao carregar despesas: ${cashRes.error.message}`)
      setLoading(false)
      return
    }

    const sMap = new Map<string, SalesAgg>()
    for (const row of (salesRes.data ?? []) as any[]) {
      const sid = String(row.store_id || "")
      const total = Number(row.total_final ?? 0)
      const prev = sMap.get(sid) ?? { store_id: sid, n: 0, total: 0 }
      prev.n += 1
      prev.total = round2(prev.total + (Number.isFinite(total) ? total : 0))
      sMap.set(sid, prev)
    }
    setSalesAgg(sMap)

    const cMap = new Map<string, CashAgg>()
    for (const row of (cashRes.data ?? []) as any[]) {
      const sid = String(row.store_id || "")
      const total = Number(row.amount_total ?? 0)
      const prev = cMap.get(sid) ?? { store_id: sid, n: 0, total: 0 }
      prev.n += 1
      prev.total = round2(prev.total + (Number.isFinite(total) ? total : 0))
      cMap.set(sid, prev)
    }
    setCashAgg(cMap)

    setLoading(false)
  }

  async function loadStoreDetail(storeId: string) {
    setDetailLoading(true)
    setErrorMsg(null)

    const pRes = await supabase
      .from("products")
      .select("id, store_id, codigo, tipo, descricao, marca, fornecedor, preco, estoque_minimo")
      .eq("store_id", storeId)
      .order("codigo", { ascending: true, nullsFirst: false })

    if (pRes.error) {
      setErrorMsg(`Erro ao carregar produtos da loja: ${pRes.error.message}`)
      setDetailLoading(false)
      return
    }

    const iRes = await supabase
      .from("inventory")
      .select("product_id, quantidade, unidade")
      .eq("store_id", storeId)

    if (iRes.error) {
      setErrorMsg(`Erro ao carregar estoque da loja: ${iRes.error.message}`)
      setDetailLoading(false)
      return
    }

    const sRes = await supabase
      .from("sales")
      .select("id, store_id, created_at, customer_name, total_final, payment_method")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(20)

    if (sRes.error) {
      setErrorMsg(`Erro ao carregar vendas da loja: ${sRes.error.message}`)
      setDetailLoading(false)
      return
    }

    setDetailProducts((pRes.data as ProductRow[]) ?? [])
    setDetailInventory((iRes.data as InventoryRow[]) ?? [])
    setDetailSales((sRes.data as SaleRow[]) ?? [])

    setDetailLoading(false)
  }

  useEffect(() => {
    loadOverview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // quando muda a data, recarrega overview (pra evitar esquecimento)
    if (!isAdmin) return
    loadOverview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO])

  const filteredStores = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return stores
    return stores.filter((s) => (s.name || "").toLowerCase().includes(term))
  }, [stores, q])

  const totals = useMemo(() => {
    let totalSales = 0
    let totalCash = 0
    let nSales = 0
    let nCash = 0

    for (const s of stores) {
      const sa = salesAgg.get(s.id)
      if (sa) {
        totalSales += sa.total
        nSales += sa.n
      }
      const ca = cashAgg.get(s.id)
      if (ca) {
        totalCash += ca.total
        nCash += ca.n
      }
    }

    return {
      totalSales: round2(totalSales),
      totalCash: round2(totalCash),
      nSales,
      nCash,
      net: round2(totalSales - totalCash),
    }
  }, [stores, salesAgg, cashAgg])

  const inventoryByProductId = useMemo(() => {
    const map = new Map<string, InventoryRow>()
    for (const r of detailInventory) map.set(String(r.product_id), r)
    return map
  }, [detailInventory])

  const alerts = useMemo(() => {
    const list: {
      codigo: number | null
      descricao: string
      marca: string | null
      qtd: number
      unidade: string
      min: number | null
      level: "red" | "orange"
      text: string
    }[] = []

    for (const p of detailProducts) {
      const inv = inventoryByProductId.get(p.id)
      const qtd = Number(inv?.quantidade ?? 0)
      const uni = (inv?.unidade || "un").trim() || "un"
      const min = p.estoque_minimo
      const st = statusLabel(qtd, min)
      if (st.level === "red" || st.level === "orange") {
        list.push({
          codigo: p.codigo,
          descricao: p.descricao,
          marca: p.marca,
          qtd,
          unidade: uni,
          min: min ?? null,
          level: st.level,
          text: st.text,
        })
      }
    }

    list.sort((a, b) => {
      if (a.level !== b.level) return a.level === "red" ? -1 : 1
      return (a.codigo ?? 999999) - (b.codigo ?? 999999)
    })

    return list.slice(0, 20)
  }, [detailProducts, inventoryByProductId])

  if (loading) {
    return <div className="text-sm text-slate-600">Carregando…</div>
  }

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Acesso restrito. (Somente admin.)
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-11 w-11 rounded-2xl bg-[#EAF7FF] border border-black/5 flex items-center justify-center">
            <IconShield />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Admin (Tebas)</h1>
            <p className="text-sm text-slate-600 mt-1">
              Visão global por loja. Totais diários por data selecionada.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <label className="block w-full sm:w-[220px]">
            <span className="text-sm font-semibold text-slate-800">Data</span>
            <input
              type="date"
              value={dateISO}
              onChange={(e) => setDateISO(e.target.value)}
              className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
            />
          </label>

          <button
            onClick={loadOverview}
            className="h-11 px-5 rounded-2xl bg-[#00D6FF] text-slate-900 text-sm font-semibold hover:brightness-95 w-full sm:w-auto"
          >
            Recarregar
          </button>
        </div>
      </div>

      {errorMsg ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi title="Lojas" value={String(stores.length)} hint="Total cadastradas" icon={<IconStore />} />
        <Kpi title="Vendas" value={String(totals.nSales)} hint="Lançamentos no dia" icon={<IconCart />} />
        <Kpi title="Receita" value={formatMoneyBR(totals.totalSales)} hint="Total do dia" icon={<IconMoney />} />
        <Kpi title="Saldo" value={formatMoneyBR(totals.net)} hint="Receita - Despesas" icon={<IconChart />} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="block md:col-span-2">
          <span className="text-sm font-semibold text-slate-800">Buscar loja</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Digite o nome da loja…"
            className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          />
        </label>

        <div className="rounded-2xl bg-[#EAF7FF] border border-black/5 p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Mostrando</div>
            <div className="text-xs text-slate-600">Resultado / Total</div>
          </div>
          <div className="text-xl font-semibold text-slate-900">
            {filteredStores.length} / {stores.length}
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Lojas</div>
          <div className="text-xs text-slate-600">
            Clique em Detalhes para ver vendas recentes e alertas de estoque.
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Loja</th>
                <th className="text-right font-semibold px-4 py-3">Vendas (qtd)</th>
                <th className="text-right font-semibold px-4 py-3">Receita</th>
                <th className="text-right font-semibold px-4 py-3">Despesas</th>
                <th className="text-right font-semibold px-4 py-3">Saldo</th>
                <th className="text-right font-semibold px-4 py-3">Ações</th>
              </tr>
            </thead>

            <tbody className="bg-white">
              {filteredStores.length === 0 ? (
                <tr className="border-t border-black/5">
                  <td className="px-4 py-5 text-slate-600" colSpan={6}>
                    Nenhuma loja encontrada.
                  </td>
                </tr>
              ) : (
                filteredStores.map((s) => {
                  const sa = salesAgg.get(s.id)
                  const ca = cashAgg.get(s.id)

                  const receita = round2(sa?.total ?? 0)
                  const despesas = round2(ca?.total ?? 0)
                  const saldo = round2(receita - despesas)

                  return (
                    <tr key={s.id} className="border-t border-black/5 hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{s.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{s.id}</div>
                      </td>

                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {sa?.n ?? 0}
                      </td>

                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatMoneyBR(receita)}
                      </td>

                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatMoneyBR(despesas)}
                      </td>

                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatMoneyBR(saldo)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={async () => {
                            const next = openStoreId === s.id ? null : s.id
                            setOpenStoreId(next)
                            if (next) await loadStoreDetail(next)
                          }}
                          className="h-10 px-4 rounded-2xl bg-white border border-black/10 text-slate-900 text-sm font-semibold hover:bg-slate-50"
                        >
                          {openStoreId === s.id ? "Fechar" : "Detalhes"}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {openStoreId ? (
        <section className="rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Detalhes da loja</div>
              <div className="text-xs text-slate-600 mt-1">
                Últimas vendas + alertas de estoque (máx. 20).
              </div>
            </div>

            <button
              onClick={() => setOpenStoreId(null)}
              className="h-10 px-4 rounded-2xl bg-white border border-black/10 text-slate-900 text-sm font-semibold hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>

          {detailLoading ? (
            <div className="px-5 py-6 text-sm text-slate-600">Carregando detalhes…</div>
          ) : (
            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-2xl border border-black/5 bg-slate-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">Últimas vendas</div>
                  <div className="text-xs text-slate-600">{detailSales.length} itens</div>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead className="bg-white text-slate-700">
                      <tr>
                        <th className="text-left font-semibold px-3 py-2">Data</th>
                        <th className="text-left font-semibold px-3 py-2">Cliente</th>
                        <th className="text-left font-semibold px-3 py-2">Pagamento</th>
                        <th className="text-right font-semibold px-3 py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-slate-50">
                      {detailSales.length === 0 ? (
                        <tr className="border-t border-black/5">
                          <td className="px-3 py-4 text-slate-600" colSpan={4}>
                            Sem vendas ainda.
                          </td>
                        </tr>
                      ) : (
                        detailSales.map((r) => (
                          <tr key={r.id} className="border-t border-black/5">
                            <td className="px-3 py-2 text-slate-700">{formatDateBR(r.created_at)}</td>
                            <td className="px-3 py-2 text-slate-700">{r.customer_name || "—"}</td>
                            <td className="px-3 py-2 text-slate-700">{r.payment_method || "—"}</td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-900">
                              {formatMoneyBR(Number(r.total_final ?? 0))}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-black/5 bg-slate-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">Alertas de estoque</div>
                  <div className="text-xs text-slate-600">{alerts.length} itens</div>
                </div>

                <div className="overflow-auto">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead className="bg-white text-slate-700">
                      <tr>
                        <th className="text-left font-semibold px-3 py-2">ID</th>
                        <th className="text-left font-semibold px-3 py-2">Produto</th>
                        <th className="text-right font-semibold px-3 py-2">Qtd</th>
                        <th className="text-left font-semibold px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-slate-50">
                      {alerts.length === 0 ? (
                        <tr className="border-t border-black/5">
                          <td className="px-3 py-4 text-slate-600" colSpan={4}>
                            Sem alertas (OK).
                          </td>
                        </tr>
                      ) : (
                        alerts.map((a) => (
                          <tr key={(a.codigo ?? 0) + a.descricao} className="border-t border-black/5">
                            <td className="px-3 py-2 font-semibold text-slate-900">
                              {a.codigo ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              {a.descricao}
                              <div className="text-xs text-slate-500 mt-0.5">{a.marca || "Outros"}</div>
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-900">
                              {String(a.qtd)} {a.unidade}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={
                                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold " +
                                  (a.level === "red"
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : "bg-amber-50 text-amber-800 border-amber-200")
                                }
                              >
                                <span className="inline-block h-2 w-2 rounded-full bg-current opacity-70" />
                                {a.text}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}

function todayISO() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function formatMoneyBR(n: number) {
  if (!Number.isFinite(n)) return "0,00"
  return n.toFixed(2).replace(".", ",")
}

function formatDateBR(iso: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, "0")
  const mi = String(d.getMinutes()).padStart(2, "0")
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`
}

function statusLabel(qtd: number, min: number | null) {
  if (min === null || min === undefined) return { text: "Sem mínimo", level: "none" as const }
  if (min <= 0) return { text: "Mínimo inválido", level: "none" as const }

  const extra = Math.ceil(min * 0.25)
  const limiteLaranja = min + extra

  if (qtd <= min) return { text: `Crítico (≤ ${min})`, level: "red" as const }
  if (qtd <= limiteLaranja) return { text: `Atenção (≤ ${limiteLaranja})`, level: "orange" as const }

  return { text: "OK", level: "green" as const }
}

function Kpi({
  title,
  value,
  hint,
  icon,
}: {
  title: string
  value: string
  hint: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-[#EAF7FF] border border-black/5 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="text-xs text-slate-600">{hint}</div>
        </div>
      </div>
      <div className="text-xl font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2 20 6v6c0 5-3.5 9.4-8 10-4.5-.6-8-5-8-10V6l8-4Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}

function IconStore() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10l2-6h14l2 6M5 10v10h14V10M9 20v-7h6v7" />
    </svg>
  )
}

function IconCart() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6h15l-2 9H7L6 6Z" />
      <path d="M6 6 5 3H2" />
      <path d="M7 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm12 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    </svg>
  )
}

function IconMoney() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7h18v10H3z" />
      <path d="M7 11h.01" />
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    </svg>
  )
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19V5M4 19h16" />
      <path d="M8 17V9M12 17V7M16 17v-5M20 17v-8" />
    </svg>
  )
}
