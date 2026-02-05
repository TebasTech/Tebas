// src/app/app/produtos/page.tsx
"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"

/**
 * ✅ Ajuste pedido:
 * - No "Novo produto", não iniciar com "Outros" selecionado.
 *   Começa vazio ("Selecione...") e o usuário escolhe.
 *
 * Observação:
 * Se sua tabela tiver "category" obrigatório, no insert eu aplico fallback "Outros".
 */

type Product = {
  id: number
  created_at: string
  description: string
  brand: string | null
  supplier: string | null
  category: string | null
  unit_price: number | null
}

const CATEGORIES = ["Ração", "Medicamento", "Acessório", "Higiene", "Outros"]

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

  // ✅ começa vazio
  const [category, setCategory] = useState<string>("")

  const [description, setDescription] = useState("")
  const [brand, setBrand] = useState("")
  const [supplier, setSupplier] = useState("")
  const [unitPrice, setUnitPrice] = useState("")

  async function load() {
    setLoading(true)
    setErr(null)
    const { data, error } = await supabase
      .from("products")
      .select("id, created_at, description, brand, supplier, category, unit_price")
      .order("id", { ascending: true })
      .limit(500)

    if (error) setErr(error.message)
    setRows((data ?? []) as any)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function add() {
    setErr(null)

    const payload = {
      description: description.trim(),
      brand: brand.trim() || null,
      supplier: supplier.trim() || null,
      category: category.trim() || "Outros", // fallback
      unit_price: toNumberBR(unitPrice),
    }

    const { error } = await supabase.from("products").insert(payload as any)
    if (error) return setErr(error.message)

    setDescription("")
    setBrand("")
    setSupplier("")
    setUnitPrice("")
    setCategory("") // ✅ volta vazio
    await load()
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-bold text-slate-900">Produtos</div>
        <div className="text-sm text-slate-600">Cadastre itens e preços.</div>
      </div>

      {err && <div className="text-sm text-red-600">Erro: {err}</div>}

      <div className="rounded-2xl border border-black/5 shadow-sm bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição"
            className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF] md:col-span-2"
          />
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Marca (opcional)"
            className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          />
          <input
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="Fornecedor (opcional)"
            className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          />

          {/* ✅ categoria vazia */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          >
            <option value="">Selecione...</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <input
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            placeholder="Preço (ex: 12,50)"
            className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={add}
            className="h-11 px-5 rounded-2xl bg-[#00D6FF] text-slate-900 text-sm font-semibold hover:brightness-95"
          >
            Salvar
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-white border-b border-black/5 flex items-center justify-between">
          <div className="font-semibold text-slate-900">Itens</div>
          <div className="text-sm text-slate-600">{rows.length}</div>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="text-left px-4 py-3">ID</th>
              <th className="text-left px-4 py-3">Produto</th>
              <th className="text-left px-4 py-3">Categoria</th>
              <th className="text-right px-4 py-3">Preço</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-slate-500">
                  Carregando...
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} className="border-t border-black/5">
                  <td className="px-4 py-3 text-slate-700">{p.id}</td>
                  <td className="px-4 py-3 text-slate-900">
                    {p.description} {p.brand ? <span className="text-slate-600">• {p.brand}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{p.category || "-"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {moneyBR(Number(p.unit_price ?? 0))}
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
