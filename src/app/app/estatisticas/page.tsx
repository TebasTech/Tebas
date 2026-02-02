"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"

type AnyRow = Record<string, any>

export default function EstatisticasPage() {
  const router = useRouter()

  const [storeId, setStoreId] = useState<string | null>(null)

  const [sales, setSales] = useState<AnyRow[]>([])
  const [customers, setCustomers] = useState<AnyRow[]>([])
  const [products, setProducts] = useState<AnyRow[]>([])
  const [inventory, setInventory] = useState<AnyRow[]>([])

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [range, setRange] = useState<"7d" | "14d" | "30d">("14d")

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

  function endOfDay(d: Date) {
    const x = new Date(d)
    x.setHours(23, 59, 59, 999)
    return x
  }

  function startOfMonth(d: Date) {
    const x = new Date(d.getFullYear(), d.getMonth(), 1)
    x.setHours(0, 0, 0, 0)
    return x
  }

  function addDays(d: Date, days: number) {
    const x = new Date(d)
    x.setDate(x.getDate() + days)
    return x
  }

  function addMonths(d: Date, months: number) {
    const x = new Date(d)
    x.setMonth(x.getMonth() + months)
    return x
  }

  function saleDateISO(s: AnyRow): string | null {
    // tenta os campos mais comuns
    const iso =
      (s.created_at as string) ||
      (s.sold_at as string) ||
      (s.date as string) ||
      (s.data as string)
    return iso || null
  }

  function saleValue(s: AnyRow) {
    // tenta achar o melhor campo disponível no seu schema
    const candidates = [
      s.total_final,
      s.total_received,
      s.total,
      s.subtotal_total,
      s.subtotal,
      s.value,
      s.valor,
    ]
    for (const c of candidates) {
      const n = Number(c)
      if (Number.isFinite(n)) return round2(n)
    }
    return 0
  }

  async function loadAll(currentStoreId: string) {
    setErrorMsg(null)
    setLoading(true)

    const now = new Date()

    // Vendas: puxa últimos 6 meses (bastante para gráficos de dia/mês)
    const fromSales = startOfDay(addMonths(now, -6)).toISOString()

    const sRes = await supabase
      .from("sales")
      .select("*")
      .eq("store_id", currentStoreId)
      .gte("created_at", fromSales)
      .order("created_at", { ascending: true })

    if (sRes.error) {
      setSales([])
      setCustomers([])
      setProducts([])
      setInventory([])
      setErrorMsg(`Erro ao carregar vendas: ${sRes.error.message}`)
      setLoading(false)
      return
    }

    const cRes = await supabase
      .from("customers")
      .select("*")
      .eq("store_id", currentStoreId)
      .order("created_at", { ascending: false })
      .limit(2000)

    if (cRes.error) {
      setSales((sRes.data as AnyRow[]) ?? [])
      setCustomers([])
      setProducts([])
      setInventory([])
      setErrorMsg(`Erro ao carregar clientes: ${cRes.error.message}`)
      setLoading(false)
      return
    }

    const pRes = await supabase
      .from("products")
      .select("*")
      .eq("store_id", currentStoreId)

    if (pRes.error) {
      setSales((sRes.data as AnyRow[]) ?? [])
      setCustomers((cRes.data as AnyRow[]) ?? [])
      setProducts([])
      setInventory([])
      setErrorMsg(`Erro ao carregar produtos: ${pRes.error.message}`)
      setLoading(false)
      return
    }

    const iRes = await supabase
      .from("inventory")
      .select("*")
      .eq("store_id", currentStoreId)

    if (iRes.error) {
      setSales((sRes.data as AnyRow[]) ?? [])
      setCustomers((cRes.data as AnyRow[]) ?? [])
      setProducts((pRes.data as AnyRow[]) ?? [])
      setInventory([])
      setErrorMsg(`Erro ao carregar estoque: ${iRes.error.message}`)
      setLoading(false)
      return
    }

    setSales((sRes.data as AnyRow[]) ?? [])
    setCustomers((cRes.data as AnyRow[]) ?? [])
    setProducts((pRes.data as AnyRow[]) ?? [])
    setInventory((iRes.data as AnyRow[]) ?? [])

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

  const inventoryByProductId = useMemo(() => {
    const map = new Map<string, AnyRow>()
    for (const row of inventory) map.set(String(row.product_id), row)
    return map
  }, [inventory])

  function statusLevel(qtd: number, min: number | null) {
    if (min === null || min === undefined || min <= 0) return "none" as const
    const extra = Math.ceil(min * 0.25)
    const lim = min + extra
    if (qtd <= min) return "red" as const
    if (qtd <= lim) return "orange" as const
    return "green" as const
  }

  const stockAlerts = useMemo(() => {
    let red = 0
    let orange = 0

    for (const p of products) {
      const pid = String(p.id)
      const qtd = Number(inventoryByProductId.get(pid)?.quantidade ?? 0) || 0
      const minRaw = p.estoque_minimo
      const min = minRaw === null || minRaw === undefined ? null : Number(minRaw)
      const lvl = statusLevel(qtd, Number.isFinite(min as any) ? (min as number) : null)
      if (lvl === "red") red++
      if (lvl === "orange") orange++
    }

    return { red, orange, total: red + orange }
  }, [products, inventoryByProductId])

  const now = new Date()
  const dayStart = startOfDay(now)
  const dayEnd = endOfDay(now)
  const monthStart = startOfMonth(now)
  const monthEnd = endOfDay(addDays(addMonths(monthStart, 1), -1))

  const salesToday = useMemo(() => {
    return sales.filter((s) => {
      const iso = saleDateISO(s)
      if (!iso) return false
      const d = new Date(iso)
      return d >= dayStart && d <= dayEnd
    })
  }, [sales])

  const salesMonth = useMemo(() => {
    return sales.filter((s) => {
      const iso = saleDateISO(s)
      if (!iso) return false
      const d = new Date(iso)
      return d >= monthStart && d <= monthEnd
    })
  }, [sales])

  const revenueToday = useMemo(() => sum(salesToday.map(saleValue)), [salesToday])
  const revenueMonth = useMemo(() => sum(salesMonth.map(saleValue)), [salesMonth])
  const avgTicketMonth = useMemo(
    () => (salesMonth.length ? round2(revenueMonth / salesMonth.length) : 0),
    [revenueMonth, salesMonth]
  )

  const customersCount = customers.length
  const productsCount = products.length

  const dailySeries = useMemo(() => {
    const days = range === "7d" ? 7 : range === "14d" ? 14 : 30
    const start = startOfDay(addDays(now, -(days - 1)))
    const buckets: { key: string; label: string; count: number; value: number }[] = []

    for (let i = 0; i < days; i++) {
      const d = addDays(start, i)
      const dd = String(d.getDate()).padStart(2, "0")
      const mm = String(d.getMonth() + 1).padStart(2, "0")
      const key = d.toISOString().slice(0, 10)
      buckets.push({ key, label: `${dd}/${mm}`, count: 0, value: 0 })
    }

    const map = new Map(buckets.map((b) => [b.key, b]))

    for (const s of sales) {
      const iso = saleDateISO(s)
      if (!iso) continue
      const key = new Date(iso).toISOString().slice(0, 10)
      const b = map.get(key)
      if (!b) continue
      b.count += 1
      b.value += saleValue(s)
    }

    return buckets
  }, [sales, range])

  const monthlySeries = useMemo(() => {
    // últimos 6 meses (inclui atual)
    const monthsBack = 5
    const first = startOfMonth(addMonths(now, -monthsBack))
    const buckets: { key: string; label: string; count: number; value: number }[] = []

    for (let i = 0; i < 6; i++) {
      const d = addMonths(first, i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const label = shortMonth(d.getMonth()) + "/" + String(d.getFullYear()).slice(2)
      buckets.push({ key, label, count: 0, value: 0 })
    }

    const map = new Map(buckets.map((b) => [b.key, b]))

    for (const s of sales) {
      const iso = saleDateISO(s)
      if (!iso) continue
      const d = new Date(iso)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const b = map.get(key)
      if (!b) continue
      b.count += 1
      b.value += saleValue(s)
    }

    return buckets
  }, [sales])

  const payBreakdown = useMemo(() => {
    const map = new Map<string, { method: string; count: number; value: number }>()
    for (const s of salesMonth) {
      const m = String(s.payment_method ?? "—").trim() || "—"
      const cur = map.get(m) ?? { method: m, count: 0, value: 0 }
      cur.count += 1
      cur.value += saleValue(s)
      map.set(m, cur)
    }
    const list = Array.from(map.values())
    list.sort((a, b) => b.value - a.value)
    return list
  }, [salesMonth])

  const topDay = useMemo(() => {
    if (!dailySeries.length) return null
    const best = dailySeries.reduce((acc, x) => (x.value > acc.value ? x : acc), dailySeries[0])
    return best
  }, [dailySeries])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Estatísticas</h1>
          <p className="text-sm text-slate-600 mt-1">
            Um resumo simples do que está acontecendo na sua loja.
          </p>
        </div>

        <button
          onClick={() => (storeId ? loadAll(storeId) : null)}
          className="h-11 px-5 rounded-2xl bg-white border border-black/10 text-slate-900 text-sm font-semibold hover:bg-slate-50 w-full md:w-auto"
        >
          Atualizar
        </button>
      </div>

      {errorMsg ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      {loading ? (
        <div className="px-2 py-6 text-sm text-slate-600">Carregando…</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Kpi title="Vendas hoje" subtitle={formatDateBR(new Date())} value={String(salesToday.length)} badge="Hoje" />
            <Kpi title="Receita hoje" subtitle="Somatório das vendas" value={`R$ ${formatMoney(revenueToday)}`} badge="Hoje" />
            <Kpi title="Vendas no mês" subtitle={monthLabel(new Date())} value={String(salesMonth.length)} badge="Mês" />
            <Kpi title="Receita no mês" subtitle={monthLabel(new Date())} value={`R$ ${formatMoney(revenueMonth)}`} badge="Mês" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Kpi title="Ticket médio (mês)" subtitle="Receita / vendas" value={`R$ ${formatMoney(avgTicketMonth)}`} />
            <Kpi title="Clientes cadastrados" subtitle="Total de clientes" value={String(customersCount)} />
            <Kpi title="Produtos cadastrados" subtitle="Itens no catálogo" value={String(productsCount)} />
          </div>

          {/* Alert + Daily */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Estoque em alerta</div>
                  <div className="text-xs text-slate-600 mt-1">Vermelho ou laranja</div>
                </div>
                <span className="inline-flex items-center rounded-full bg-[#EAF7FF] border border-black/5 px-3 py-1 text-xs font-semibold text-slate-900">
                  {stockAlerts.total}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                  <div className="text-xs text-red-700 font-semibold">Crítico</div>
                  <div className="text-lg text-red-700 font-semibold mt-1">{stockAlerts.red}</div>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="text-xs text-amber-800 font-semibold">Atenção</div>
                  <div className="text-lg text-amber-800 font-semibold mt-1">{stockAlerts.orange}</div>
                </div>
              </div>

              <div className="text-xs text-slate-500 mt-3">
                Dica: veja a tela <b>Estoque</b> para ajustar mínimos e quantidades.
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-5 md:col-span-2">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Vendas por dia</div>
                  <div className="text-xs text-slate-600 mt-1">
                    {rangeLabel(range)} • {topDay ? `Melhor dia: ${topDay.label} (R$ ${formatMoney(topDay.value)})` : "—"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <SegmentButton active={range === "7d"} onClick={() => setRange("7d")}>7 dias</SegmentButton>
                  <SegmentButton active={range === "14d"} onClick={() => setRange("14d")}>14 dias</SegmentButton>
                  <SegmentButton active={range === "30d"} onClick={() => setRange("30d")}>30 dias</SegmentButton>
                </div>
              </div>

              <MiniBars
                series={dailySeries.map((d) => ({ label: d.label, value: d.value }))}
                height={110}
              />

              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                <SmallStat label="Total no período" value={`R$ ${formatMoney(sum(dailySeries.map((d) => d.value)))}`} />
                <SmallStat label="Vendas no período" value={String(sum(dailySeries.map((d) => d.count)))} />
                <SmallStat label="Média por dia" value={`R$ ${formatMoney(avg(dailySeries.map((d) => d.value)))}`} />
                <SmallStat label="Maior dia" value={`R$ ${formatMoney(max(dailySeries.map((d) => d.value)))}`} />
              </div>
            </div>
          </div>

          {/* Monthly + Payment */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-5 md:col-span-2">
              <div className="text-sm font-semibold text-slate-900">Receita por mês</div>
              <div className="text-xs text-slate-600 mt-1">Últimos 6 meses</div>

              <MiniBars
                series={monthlySeries.map((m) => ({ label: m.label, value: m.value }))}
                height={120}
              />

              <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
                <SmallStat label="Melhor mês" value={bestMonthLabel(monthlySeries)} />
                <SmallStat label="Média por mês" value={`R$ ${formatMoney(avg(monthlySeries.map((m) => m.value)))}`} />
                <SmallStat label="Total 6 meses" value={`R$ ${formatMoney(sum(monthlySeries.map((m) => m.value)))}`} />
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-5">
              <div className="text-sm font-semibold text-slate-900">Pagamento (mês)</div>
              <div className="text-xs text-slate-600 mt-1">Onde o dinheiro entrou</div>

              {payBreakdown.length === 0 ? (
                <div className="mt-4 text-sm text-slate-600">Sem vendas no mês.</div>
              ) : (
                <div className="mt-4 space-y-3">
                  {payBreakdown.map((p) => (
                    <div key={p.method} className="rounded-2xl border border-black/5 bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-900">{p.method}</div>
                        <div className="text-sm font-semibold text-slate-900">R$ {formatMoney(p.value)}</div>
                      </div>
                      <div className="text-xs text-slate-600 mt-1">{p.count} venda(s)</div>
                      <div className="mt-2 h-2 rounded-full bg-white border border-black/5 overflow-hidden">
                        <div className="h-full bg-[#00D6FF]" style={{ width: `${pct(p.value, revenueMonth)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-xs text-slate-500 mt-3">
                Se aparecer “—”, significa que a venda foi salva sem selecionar pagamento.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Kpi({
  title,
  subtitle,
  value,
  badge,
}: {
  title: string
  subtitle: string
  value: string
  badge?: string
}) {
  return (
    <div className="rounded-2xl bg-white border border-black/5 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="text-xs text-slate-600 mt-1">{subtitle}</div>
        </div>

        {badge ? (
          <span className="inline-flex items-center rounded-full bg-[#EAF7FF] border border-black/5 px-3 py-1 text-xs font-semibold text-slate-900">
            {badge}
          </span>
        ) : null}
      </div>

      <div className="mt-4 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "h-10 px-4 rounded-2xl bg-[#00D6FF] text-slate-900 text-xs font-semibold hover:brightness-95"
          : "h-10 px-4 rounded-2xl bg-white border border-black/10 text-slate-900 text-xs font-semibold hover:bg-slate-50"
      }
    >
      {children}
    </button>
  )
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-slate-50 px-4 py-3">
      <div className="text-xs text-slate-600">{label}</div>
      <div className="text-sm font-semibold text-slate-900 mt-1">{value}</div>
    </div>
  )
}

function MiniBars({
  series,
  height,
}: {
  series: { label: string; value: number }[]
  height: number
}) {
  const maxV = Math.max(1, ...series.map((s) => s.value))

  return (
    <div className="mt-4">
      <div className="rounded-2xl border border-black/5 bg-slate-50 p-4 overflow-hidden">
        <div className="flex items-end gap-2" style={{ height }}>
          {series.map((s, idx) => {
            const h = Math.max(2, Math.round((s.value / maxV) * height))
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-xl bg-[#00D6FF] opacity-90"
                  style={{ height: h }}
                  title={`${s.label} • R$ ${formatMoney(s.value)}`}
                />
                <div className="text-[11px] text-slate-600">{s.label}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* helpers */
function sum(arr: number[]) {
  let t = 0
  for (const n of arr) t += Number.isFinite(n) ? n : 0
  return round2(t)
}

function avg(arr: number[]) {
  if (!arr.length) return 0
  return round2(sum(arr) / arr.length)
}

function max(arr: number[]) {
  if (!arr.length) return 0
  let m = arr[0] ?? 0
  for (const n of arr) if (n > m) m = n
  return round2(m)
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function formatMoney(n: number) {
  if (!Number.isFinite(n)) return "0,00"
  return n.toFixed(2).replace(".", ",")
}

function formatDateBR(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yy = d.getFullYear()
  return `${dd}/${mm}/${yy}`
}

function monthLabel(d: Date) {
  return `${longMonth(d.getMonth())} ${d.getFullYear()}`
}

function shortMonth(m: number) {
  const arr = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
  return arr[m] ?? "—"
}

function longMonth(m: number) {
  const arr = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ]
  return arr[m] ?? "—"
}

function rangeLabel(r: "7d" | "14d" | "30d") {
  if (r === "7d") return "Últimos 7 dias"
  if (r === "14d") return "Últimos 14 dias"
  return "Últimos 30 dias"
}

function pct(part: number, total: number) {
  if (!total) return 0
  const v = Math.round((part / total) * 100)
  return Math.min(100, Math.max(0, v))
}

function bestMonthLabel(series: { label: string; value: number }[]) {
  if (!series.length) return "—"
  let best = series[0]
  for (const s of series) if (s.value > best.value) best = s
  return `${best.label} • R$ ${formatMoney(best.value)}`
}
