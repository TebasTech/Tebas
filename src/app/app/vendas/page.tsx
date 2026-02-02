"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"

// Tipagens
type Product = { id: string; codigo: number; descricao: string; marca?: string; preco: number }
type Customer = { id: string; name: string }
type SaleHistory = { sale_number: number; total: number; payment_method: string; created_at: string; customer_name: string }
type CartLine = { product: Product; qty: number; discountPercent: number; finalPrice: number }

export default function VendasPage() {
  const router = useRouter()
  const inputIdRef = useRef<HTMLInputElement>(null)

  // Estados de Dados
  const [storeId, setStoreId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [history, setHistory] = useState<SaleHistory[]>([])
  
  // Estados da Venda Atual
  const [vendaData, setVendaData] = useState(new Date().toISOString().split('T')[0])
  const [selectedCustomerId, setSelectedCustomerId] = useState("indefinido")
  const [payment, setPayment] = useState("Dinheiro")
  const [cart, setCart] = useState<CartLine[]>([])
  const [codeInput, setCodeInput] = useState("")
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return
      const { data: prof } = await supabase.from("users_profile").select("store_id").eq("id", auth.user.id).single()
      if (prof) {
        setStoreId(prof.store_id)
        setUserId(auth.user.id)
        loadData(prof.store_id)
      }
    }
    init()
  }, [])

  async function loadData(sid: string) {
    const [pRes, hRes, cRes] = await Promise.all([
      supabase.from("products").select("*").eq("store_id", sid).order("codigo"),
      supabase.from("sales").select("*, customers(name)").eq("store_id", sid).order("created_at", { ascending: false }).limit(10),
      supabase.from("customers").select("id, name").eq("store_id", sid)
    ])
    setProducts(pRes.data || [])
    setCustomers(cRes.data || [])
    setHistory(hRes.data?.map(s => ({ ...s, customer_name: s.customers?.name || "Indefinido" })) || [])
    setLoading(false)
  }

  // Funções de Auxílio
  const toReal = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const parseComma = (s: string) => Number(String(s).replace(",", "."))

  function handleAddByCode() {
    const clean = codeInput.replace("*", "").trim()
    const p = products.find(x => x.codigo === Number(clean))
    if (p) {
      setCart(prev => [...prev, { product: p, qty: 1, discountPercent: 0, finalPrice: p.preco }])
      setCodeInput("")
      setTimeout(() => inputIdRef.current?.focus(), 50)
    }
  }

  function updateCart(id: string, field: "q"|"p"|"d", val: string) {
    const n = parseComma(val)
    setCart(prev => prev.map((l, index) => {
      // Usamos index ou ID para evitar erro se tiver o mesmo produto 2x
      if (l.product.id !== id) return l
      let { qty, finalPrice, discountPercent } = l
      const original = l.product.preco

      if (field === "q") qty = n
      if (field === "p") {
        finalPrice = n
        discountPercent = original > 0 ? ((original - n) / original) * 100 : 0
      }
      if (field === "d") {
        discountPercent = n
        finalPrice = original - (original * (n / 100))
      }
      return { ...l, qty, finalPrice, discountPercent }
    }))
  }

  const totalGeral = cart.reduce((acc, curr) => acc + (curr.qty * curr.finalPrice), 0)

  async function finalizarVenda() {
    if (!storeId || cart.length === 0) return
    setSaving(true)
    
    const { data, error } = await supabase.rpc("create_sale", {
      p_store_id: storeId,
      p_user_id: userId,
      p_payment: payment,
      p_customer_id: selectedCustomerId === "indefinido" ? null : selectedCustomerId,
      p_items: cart.map(l => ({ product_id: l.product.id, qty: l.qty, price_at_sale: l.finalPrice })),
      p_created_at: vendaData // Passando a data escolhida
    })

    if (!error) {
      setCart([])
      loadData(storeId)
      alert("Venda realizada com sucesso!")
    }
    setSaving(false)
  }

  return (
    <div className="p-6 bg-[#F8FAFC] min-h-screen font-sans text-slate-900">
      
      {/* Cabeçalho de Controle */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">PDV de Vendas</h1>
          <p className="text-slate-500">Registre saídas e controle seu histórico</p>
        </div>
        <button className="bg-[#1E293B] text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all">
          Consolidada
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ESQUERDA: Configuração e Histórico */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card de Configuração da Venda */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-400">Data da Venda</label>
              <input type="date" value={vendaData} onChange={(e)=>setVendaData(e.target.value)} className="w-full h-12 border border-slate-200 rounded-xl px-4 outline-none focus:border-blue-500" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-400">Cliente</label>
              <select value={selectedCustomerId} onChange={(e)=>setSelectedCustomerId(e.target.value)} className="w-full h-12 border border-slate-200 rounded-xl px-4 outline-none focus:border-blue-500">
                <option value="indefinido">Indefinido</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Busca por ID* */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <label className="text-xs font-black uppercase text-slate-400 block mb-2">Adicionar Produto (ID*)</label>
            <div className="flex gap-3">
              <input 
                ref={inputIdRef}
                value={codeInput}
                onChange={(e)=>setCodeInput(e.target.value)}
                onKeyDown={(e)=>e.key === "Enter" && handleAddByCode()}
                placeholder="Digite o ID e asterisco. Ex: 1*" 
                className="flex-1 h-12 border border-slate-200 rounded-xl px-4 outline-none"
              />
              <button onClick={handleAddByCode} className="bg-blue-600 text-white px-8 rounded-xl font-bold">Adicionar</button>
            </div>
          </div>

          {/* Histórico Central */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-xs uppercase text-slate-500">Histórico Recente</div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/50 text-slate-400">
                <tr>
                  <th className="p-4 font-medium">Data</th>
                  <th className="p-4 font-medium">Cliente</th>
                  <th className="p-4 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-slate-500">{new Date(h.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="p-4 font-bold text-slate-700">{h.customer_name}</td>
                    <td className="p-4 text-right font-black text-blue-600">R$ {toReal(h.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* DIREITA: Carrinho e Fechamento */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-[32px] shadow-xl border border-slate-200 p-6 sticky top-6">
            <h2 className="font-black text-xl mb-6">Carrinho</h2>
            
            <div className="space-y-4 mb-8 max-h-[400px] overflow-y-auto pr-2">
              {cart.map((item, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-black text-slate-800 uppercase leading-tight">{item.product.descricao}</span>
                    <button onClick={() => setCart(c => c.filter((_, i) => i !== idx))} className="text-red-400">✕</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Qtd</span>
                      <input type="text" value={item.qty} onChange={(e)=>updateCart(item.product.id, "q", e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 px-2 text-center font-bold" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">R$ Final</span>
                      <input type="text" value={toReal(item.finalPrice)} onChange={(e)=>updateCart(item.product.id, "p", e.target.value)} className="w-full h-9 rounded-lg border border-blue-200 bg-blue-50 px-2 text-center font-bold text-blue-600" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Desc%</span>
                      <input type="text" value={item.discountPercent.toFixed(0)} onChange={(e)=>updateCart(item.product.id, "d", e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 px-2 text-center font-bold" />
                    </div>
                  </div>
                </div>
              ))}
              {cart.length === 0 && <p className="text-center text-slate-400 py-10">Carrinho vazio</p>}
            </div>

            <div className="border-t border-slate-100 pt-6 space-y-4">
              <div className="flex justify-between items-center font-black">
                <span className="text-slate-400">TOTAL</span>
                <span className="text-3xl text-blue-600">R$ {toReal(totalGeral)}</span>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase">Forma de Pagamento</label>
                <select value={payment} onChange={(e)=>setPayment(e.target.value)} className="w-full h-12 bg-slate-100 rounded-xl px-4 font-bold outline-none border-none">
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Pix">Pix</option>
                  <option value="Cartão">Cartão</option>
                </select>
              </div>

              <button 
                onClick={finalizarVenda}
                disabled={saving || cart.length === 0}
                className="w-full h-16 bg-green-500 text-white rounded-2xl font-black text-lg shadow-lg shadow-green-100 hover:bg-green-600 active:scale-95 transition-all"
              >
                {saving ? "PROCESSANDO..." : "CONCLUIR VENDA"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}