"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"

type Product = {
  id: number
  codigo: number
  descricao: string
  marca: string | null
  fornecedor: string | null
  tipo: string | null // No seu SQL está 'tipo', não 'category'
  preco: number | null
  estoque_minimo: number | null
}

const CATEGORIES = ["ração pacote", "ração granel", "diversos"]

function toNumberBR(v: string) {
  const t = String(v ?? "").trim()
  if (!t) return 0
  const norm = t.replace(/\./g, "").replace(",", ".")
  const n = Number(norm)
  if (!Number.isFinite(n)) return 0
  return n
}

function moneyBR(n: number) {
  return (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export default function Page() {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [rows, setRows] = useState<Product[]>([])

  const [tipo, setTipo] = useState<string>("") 
  const [descricao, setDescricao] = useState("")
  const [marca, setMarca] = useState("")
  const [fornecedor, setFornecedor] = useState("")
  const [unitPrice, setUnitPrice] = useState("")
  const [estMin, setEstMin] = useState("0")

  async function load() {
    setLoading(true)
    setErr(null)
    // Buscando exatamente as colunas que você criou no SQL
    const { data, error } = await supabase
      .from("products")
      .select("id, codigo, descricao, marca, fornecedor, tipo, preco, estoque_minimo")
      .order("descricao", { ascending: true })
      .limit(1000)

    if (error) setErr(error.message)
    setRows((data ?? []) as any)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function add() {
    setErr(null)
    const { data: auth } = await supabase.auth.getUser()
    
    // Pegando o próximo código sequencial baseado na lista atual
    const maxCodigo = rows.length > 0 ? Math.max(...rows.map(r => r.codigo || 0)) : 0

    const payload = {
      descricao: descricao.trim(),
      marca: marca.trim() || "XX",
      fornecedor: fornecedor.trim() || null,
      tipo: tipo || "diversos",
      preco: toNumberBR(unitPrice),
      estoque_minimo: Number(estMin),
      codigo: maxCodigo + 1
    }

    const { error } = await supabase.from("products").insert(payload as any)
    if (error) return setErr(error.message)

    setDescricao("")
    setMarca("")
    setFornecedor("")
    setUnitPrice("")
    setTipo("")
    setEstMin("0")
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <div className="text-2xl font-bold text-slate-900">Estoque Tebas</div>
          <div className="text-sm text-slate-600">Lista oficial de produtos do Randrey</div>
        </div>
      </div>

      {err && <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100">Erro: {err}</div>}

      <div className="rounded-2xl border border-slate-200 shadow-sm bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição do Produto"
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm md:col-span-2 outline-none focus:border-blue-500"
          />
          <input
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            placeholder="Marca (Ex: Magnus)"
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-blue-500"
          />
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-blue-500"
          >
            <option value="">Categoria...</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            placeholder="Preço (ex: 82,00)"
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-blue-500"
          />
          <input
            value={estMin}
            onChange={(e) => setEstMin(e.target.value)}
            placeholder="Estoque Mínimo"
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-blue-500"
          />
          <button
            onClick={add}
            className="h-11 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all md:col-span-2"
          >
            Cadastrar Produto
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black">
            <tr>
              <th className="px-4 py-3">Cód</th>
              <th className="px-4 py-3">Descrição / Marca</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3 text-right">Preço</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={4} className="p-10 text-center text-slate-400">Carregando estoque...</td></tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-400 font-mono">{p.codigo}</td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-800">{p.descricao}</div>
                    <div className="text-[10px] text-slate-400 uppercase">{p.marca}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 capitalize">{p.tipo}</td>
                  <td className="px-4 py-3 text-right font-black text-blue-600">
                    {moneyBR(Number(p.preco ?? 0))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}