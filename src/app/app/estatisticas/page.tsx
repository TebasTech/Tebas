"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"

type Mode = "day" | "month" | "year"

export default function EstatisticasPage() {
  const [mode, setMode] = useState<Mode>("day")
  const [date, setDate] = useState(today())

  const [sales, setSales] = useState(0)
  const [expenses, setExpenses] = useState(0)
  const [count, setCount] = useState(0)

  useEffect(() => {
    load()
  }, [mode, date])

  async function load() {
    const { start, end } = getRange(mode, date)

    // vendas
    const salesRes = await supabase
      .from("sales")
      .select("total_final")
      .gte("created_at", start)
      .lt("created_at", end)

    // despesas
    const expRes = await supabase
      .from("cash_out")
      .select("total")
      .gte("created_at", start)
      .lt("created_at", end)

    const s = sum(salesRes.data, "total_final")
    const e = sum(expRes.data, "total")

    setSales(s)
    setExpenses(e)
    setCount(salesRes.data?.length || 0)
  }

  const lucro = sales - expenses
  const ticket = count ? sales / count : 0

  return (
    <div className="space-y-6">

      {/* ===== FILTRO ===== */}
      <div className="flex items-center gap-3">

        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
          className="h-10 rounded-xl border px-3"
        >
          <option value="day">Dia</option>
          <option value="month">Mês</option>
          <option value="year">Ano</option>
        </select>

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 rounded-xl border px-3"
        />
      </div>

      {/* ===== CARDS ===== */}
      <div className="grid grid-cols-5 gap-4">

        <Card title="Vendas" value={money(sales)} />
        <Card title="Despesas" value={money(expenses)} />
        <Card title="Lucro" value={money(lucro)} />
        <Card title="Qtde vendas" value={count} />
        <Card title="Ticket médio" value={money(ticket)} />

      </div>

      {/* ===== ANÁLISE TEXTO ===== */}
      <div className="rounded-2xl border bg-white p-5 text-sm text-slate-700">

        {lucro >= 0 ? (
          <p>
            Resultado positivo. Sua operação gerou <b>{money(lucro)}</b> de lucro
            no período selecionado.
          </p>
        ) : (
          <p className="text-red-600">
            Atenção. Houve prejuízo de <b>{money(Math.abs(lucro))}</b>.
          </p>
        )}

      </div>
    </div>
  )
}

function Card({ title, value }: any) {
  return (
    <div className="bg-white border rounded-2xl p-4 shadow-sm">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}

function sum(arr: any[] | null, field: string) {
  if (!arr) return 0
  return arr.reduce((a, b) => a + Number(b[field] || 0), 0)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function getRange(mode: Mode, dateStr: string) {
  const d = new Date(dateStr)

  if (mode === "day") {
    const start = new Date(d)
    const end = new Date(d)
    end.setDate(end.getDate() + 1)
    return { start: start.toISOString(), end: end.toISOString() }
  }

  if (mode === "month") {
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    return { start: start.toISOString(), end: end.toISOString() }
  }

  const start = new Date(d.getFullYear(), 0, 1)
  const end = new Date(d.getFullYear() + 1, 0, 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

function money(n: number) {
  return "R$ " + n.toFixed(2).replace(".", ",")
}
