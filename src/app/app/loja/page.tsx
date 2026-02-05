"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"

type Store = {
  id: string
  name: string
  city: string | null
  address: string | null
  phone: string | null
}

export default function LojaPage() {
  const [store, setStore] = useState<Store | null>(null)

  const [name, setName] = useState("")
  const [city, setCity] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")

  const [salesToday, setSalesToday] = useState(0)
  const [salesMonth, setSalesMonth] = useState(0)
  const [expensesMonth, setExpensesMonth] = useState(0)

  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return

    const { data: profile } = await supabase
      .from("users_profile")
      .select("store_id")
      .eq("id", user.id)
      .single()

    if (!profile?.store_id) return

    const storeId = profile.store_id

    const { data: s } = await supabase
      .from("stores")
      .select("*")
      .eq("id", storeId)
      .single()

    if (s) {
      setStore(s)
      setName(s.name || "")
      setCity(s.city || "")
      setAddress(s.address || "")
      setPhone(s.phone || "")
    }

    // ===== métricas =====

    const today = new Date().toISOString().slice(0, 10)
    const firstDay = new Date()
    firstDay.setDate(1)
    const firstDayISO = firstDay.toISOString()

    const salesTodayRes = await supabase
      .from("sales")
      .select("total_final")
      .gte("created_at", today)

    const salesMonthRes = await supabase
      .from("sales")
      .select("total_final")
      .gte("created_at", firstDayISO)

    const expensesRes = await supabase
      .from("cash_out")
      .select("total")
      .gte("created_at", firstDayISO)

    setSalesToday(sum(salesTodayRes.data, "total_final"))
    setSalesMonth(sum(salesMonthRes.data, "total_final"))
    setExpensesMonth(sum(expensesRes.data, "total"))
  }

  function sum(arr: any[] | null, field: string) {
    if (!arr) return 0
    return arr.reduce((a, b) => a + Number(b[field] || 0), 0)
  }

  async function save() {
    if (!store) return
    setSaving(true)
    setMsg("")

    const { error } = await supabase
      .from("stores")
      .update({
        name,
        city,
        address,
        phone,
      })
      .eq("id", store.id)

    setSaving(false)

    if (error) setMsg(error.message)
    else setMsg("Salvo com sucesso ✓")
  }

  const lucro = salesMonth - expensesMonth

  return (
    <div className="space-y-6">

      {/* ===== NOME GRANDE ===== */}
      <h1 className="text-3xl font-bold text-slate-900">
        {name || "Minha Loja"}
      </h1>

      {/* ===== CARDS ===== */}
      <div className="grid grid-cols-4 gap-4">

        <Card title="Hoje" value={money(salesToday)} />
        <Card title="Vendas mês" value={money(salesMonth)} />
        <Card title="Despesas mês" value={money(expensesMonth)} />
        <Card title="Lucro mês" value={money(lucro)} />

      </div>

      {/* ===== FORM ===== */}
      <div className="rounded-2xl border border-black/5 bg-white p-6 space-y-4">

        <h2 className="font-semibold text-slate-900">Dados da Loja</h2>

        <div className="grid grid-cols-2 gap-4">

          <Input label="Nome" value={name} set={setName} />
          <Input label="Telefone" value={phone} set={setPhone} />
          <Input label="Cidade" value={city} set={setCity} />
          <Input label="Endereço" value={address} set={setAddress} />

        </div>

        <button
          onClick={save}
          disabled={saving}
          className="h-10 px-4 rounded-xl bg-[#00D6FF] text-black font-semibold"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>

        {msg && <p className="text-sm text-emerald-600">{msg}</p>}
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

function Input({ label, value, set }: any) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-600">{label}</label>
      <input
        value={value}
        onChange={(e) => set(e.target.value)}
        className="h-10 rounded-xl border border-slate-200 px-3"
      />
    </div>
  )
}

function money(n: number) {
  return "R$ " + n.toFixed(2).replace(".", ",")
}
