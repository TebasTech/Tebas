"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"

type SaleRow = Record<string, any>

type CustomerRow = Record<string, any>

type ProductRow = Record<string, any>

type InventoryRow = Record<string, any>

export default function EstatisticasPage() {
  const router = useRouter()

  const [storeId, setStoreId] = useState<string | null>(null)

  const [sales, setSales] = useState<SaleRow[]>([])
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [inventory, setInventory] = useState<InventoryRow[]>([])

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

  async function loadAll(currentStoreId: string) {
    setErrorMsg(null)
    setLoading(true)

    const now = new Date()

    // Vendas: puxa últimos 6 meses pra montar dia + mês
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

    // Clientes: total cadastrado (até 2000)
    const cRes = await supabase
      .from("customers")
      .select("*")
      .eq("store_id", currentStoreId)
      .order("created_at", { ascending: false })
      .limit(2000)

    if (cRes.error) {
      setSales((sRes.data as SaleRow[]) ?? [])
      setCustomers([])
      setProducts([])
      setInventory([])
      setErrorMsg(`Erro ao carregar clientes: ${cRes.error.message}`)
      setLoading(false)
      return
    }

    // Produtos / Estoque: pra mostrar alerta de estoque
    const pRes = await supabase
      .from("products")
      .select("*")
      .eq("store_id", currentStoreId)

    if (pRes.error) {
      setSales((sRes.data as SaleRow[]) ?? [])
      setCustomers((cRes.data as CustomerRow[]) ?? [])
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
      setSales((sRes.data as SaleRow[]) ?? [])
      setCustomers((cRes.data as CustomerRow[]) ?? [])
      setProducts((pRes.data as ProductRow[]) ?? [])
      setInventory([])
      setErrorMsg(`Erro ao carregar estoque: ${iRes.error.message}`)
      setLoading(false)
      return
    }

    setSales((sRes.data as SaleRow[]) ?? [])
    setCustomers((cRes.data as CustomerRow[]) ?? [])
    setProducts((pRes.data as ProductRow[]) ?? [])
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

  const inventoryByProductId = useMemo(() => {
    const map = new Map<string, InventoryRow>()
    for (const row of inventory) map.set(row.product_id, row)
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
      const qtd = inventoryByProductId.get(p.id)?.quantidade ?? 0
      const lvl = statusLevel(qtd, p.estoque_minimo)
      if (lvl === "red") red++
      if (lvl === "orange") orange++
    }
    return { red, orange, total: red + orange }
  }, [products, inventoryByProductId])

  // Receita: preferir total_final se existir, senão total
  function saleValue(s: SaleRow) {
    // tenta achar o melhor campo disponível no seu schema
    const candidates = [
      s.total_final,
      s.total_received,
      s.total,
      s.subtotal_total,
      s.subtotal,
    ]
    for (const c of candidates) {
      const n = Number(c)
      if (Number.isFinite(n)) return round2(n)
    }
    return 0
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
