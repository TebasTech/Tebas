"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"

type Product = {
  id: string
  store_id: string
  codigo: number | null
  descricao: string
  marca: string | null
  estoque_minimo: number | null
  categoria: string | null
  valor: number | null
}

const CATEGORIAS = [
  { value: "", label: "Todas" },
  { value: "ração pacote", label: "Ração" },
  { value: "ração granel", label: "Ração granel" },
  { value: "diversos", label: "Diversos" },
]

function brToNumber(v: string) {
  const t = String(v ?? "").trim()
  if (!t) return 0
  const norm = t.replace(/\./g, "").replace(",", ".")
  const n = Number(norm)
  return Number.isFinite(n) ? n : 0
}

function numberToBR(n: number) {
  return (Number(n ?? 0)).toFixed(2).replace(".", ",")
}

export default function ProdutosPage() {
  const router = useRouter()

  const [storeId, setStoreId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingNew, setSavingNew] = useState(false)

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  const [items, setItems] = useState<Product[]>([])

  // filtros
  const [fTexto, setFTexto] = useState("")
  const [fMarca, setFMarca] = useState("")
  const [fCategoria, setFCategoria] = useState("")
  const [fMin, setFMin] = useState("")
  const [fMax, setFMax] = useState("")

  // novo produto
  const [descricao, setDescricao] = useState("")
  const [marca, setMarca] = useState("")
  const [categoria, setCategoria] = useState("")
  const [estoqueMinimo, setEstoqueMinimo] = useState("0")
  const [valor, setValor] = useState("")

  // edição inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<Partial<Product>>({})
  const [savingRow, setSavingRow] = useState(false)

  async function getStoreIdOrRedirect() {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) {
      router.push("/login")
      return null
    }

    const { data, error } = await supabase
      .from("users_profile")
      .select("store_id")
      .eq("id", auth.user.id)
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

  async function loadProducts(sid: string) {
    setErrorMsg(null)

    let q = supabase
      .from("products")
      .select("id, store_id, codigo, descricao, marca, estoque_minimo, categoria, valor")
      .eq("store_id", sid)
      .order("codigo", { ascending: true, nullsFirst: false })

    // server-side filtros (leve)
    const t = fTexto.trim()
    if (t) q = q.ilike("descricao", `%${t}%`)

    const m = fMarca.trim()
    if (m) q = q.eq("marca", m)

    const c = fCategoria.trim()
    if (c) q = q.eq("categoria", c)

    const min = fMin.trim() ? brToNumber(fMin) : null
    if (min !== null && Number.isFinite(min)) q = q.gte("valor", min)

    const max = fMax.trim() ? brToNumber(fMax) : null
    if (max !== null && Number.isFinite(max)) q = q.lte("valor", max)

    const { data, error } = await q

    if (error) {
      setErrorMsg(`Erro ao carregar produtos: ${error.message}`)
      setItems([])
      return
    }

    setItems((data as Product[]) ?? [])
  }

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const sid = await getStoreIdOrRedirect()
      if (!sid) {
        setLoading(false)
        return
      }
      setStoreId(sid)
      await loadProducts(sid)
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const marcasDisponiveis = useMemo(() => {
    const set = new Set<string>()
    for (const p of items) {
      const m = (p.marca ?? "").trim()
      if (m) set.add(m)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [items])

  const totalCount = useMemo(() => items.length, [items])

  function resetNewForm() {
    setDescricao("")
    setMarca("")
    setCategoria("")
    setEstoqueMinimo("0")
    setValor("")
  }

  async function onAddNew() {
    setErrorMsg(null)
    setOkMsg(null)

    if (!storeId) {
      setErrorMsg("Loja não identificada.")
      return
    }

    const d = descricao.trim()
    if (!d) return setErrorMsg("Preencha a descrição.")

    const cat = categoria.trim()
    if (!cat) return setErrorMsg("Selecione a categoria.")

    const est = Number(String(estoqueMinimo).replace(",", "."))
    if (!Number.isFinite(est) || est < 0) return setErrorMsg("Estoque mínimo inválido.")

    const v = brToNumber(valor)
    if (!Number.isFinite(v) || v < 0) return setErrorMsg("Valor inválido.")

    setSavingNew(true)

    const payload = {
      store_id: storeId,
      descricao: d,
      marca: marca.trim() ? marca.trim() : null,
      categoria: cat,
      estoque_minimo: Math.floor(est),
      valor: v,
    }

    const { error } = await supabase.from("products").insert(payload)

    setSavingNew(false)

    if (error) return setErrorMsg(`Erro ao cadastrar: ${error.message}`)

    setOkMsg("Produto cadastrado.")
    resetNewForm()
    await loadProducts(storeId)
  }

  function startEdit(p: Product) {
    setOkMsg(null)
    setErrorMsg(null)
    setEditingId(p.id)
    setEditRow({
      descricao: p.descricao ?? "",
      marca: p.marca ?? "",
      categoria: p.categoria ?? "",
      estoque_minimo: p.estoque_minimo ?? 0,
      valor: p.valor ?? 0,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditRow({})
  }

  async function saveEditRow(id: string) {
    if (!storeId) return

    setErrorMsg(null)
    setOkMsg(null)

    const d = String(editRow.descricao ?? "").trim()
    if (!d) return setErrorMsg("Descrição não pode ficar vazia.")

    const cat = String(editRow.categoria ?? "").trim()
    if (!cat) return setErrorMsg("Categoria não pode ficar vazia.")

    const est = Number(editRow.estoque_minimo ?? 0)
    if (!Number.isFinite(est) || est < 0) return setErrorMsg("Estoque mínimo inválido.")

    const v = Number(editRow.valor ?? 0)
    if (!Number.isFinite(v) || v < 0) return setErrorMsg("Valor inválido.")

    setSavingRow(true)

    const patch = {
      descricao: d,
      marca: String(editRow.marca ?? "").trim() ? String(editRow.marca ?? "").trim() : null,
      categoria: cat,
      estoque_minimo: Math.floor(est),
      valor: v,
    }

    const { error } = await supabase.from("products").update(patch).eq("id", id)

    setSavingRow(false)

    if (error) return setErrorMsg(`Erro ao salvar edição: ${error.message}`)

    setOkMsg("Alterações salvas.")
    setEditingId(null)
    setEditRow({})
    await loadProducts(storeId)
  }

  async function onApplyFilters() {
    if (!storeId) return
    setLoading(true)
    await loadProducts(storeId)
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Produtos</h1>
        <p className="text-sm text-slate-600 mt-1">Cadastro, edição e filtros.</p>
      </div>

      {errorMsg ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>
      ) : null}

      {okMsg ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {okMsg}
        </div>
      ) : null}

      {/* Cadastro novo */}
      <section className="rounded-2xl border border-black/5 bg-white shadow-sm p-5">
        <div className="text-sm font-semibold text-slate-900 mb-3">Cadastrar novo</div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição"
            className="flex-1 h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          />

          <input
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            placeholder="Marca"
            className="w-full md:w-[220px] h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          />

          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="w-full md:w-[220px] h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          >
            <option value="">Selecione...</option>
            <option value="ração pacote">Ração</option>
            <option value="ração granel">Ração granel</option>
            <option value="diversos">Diversos</option>
          </select>

          <input
            value={estoqueMinimo}
            onChange={(e) => setEstoqueMinimo(e.target.value)}
            placeholder="Estoque mínimo"
            inputMode="numeric"
            className="w-full md:w-[170px] h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          />

          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Valor (ex: 12,50)"
            inputMode="decimal"
            className="w-full md:w-[170px] h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          />

          <button
            onClick={onAddNew}
            disabled={savingNew || loading}
            className="h-11 px-6 rounded-2xl bg-[#00D6FF] text-slate-900 text-sm font-semibold hover:brightness-95 disabled:opacity-60"
          >
            {savingNew ? "Salvando..." : "Cadastrar"}
          </button>
        </div>
      </section>

      {/* Filtros */}
      <section className="rounded-2xl border border-black/5 bg-white shadow-sm p-5">
        <div className="text-sm font-semibold text-slate-900 mb-3">Filtros</div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            value={fTexto}
            onChange={(e) => setFTexto(e.target.value)}
            placeholder="Buscar na descrição"
            className="flex-1 h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          />

          <select
            value={fMarca}
            onChange={(e) => setFMarca(e.target.value)}
            className="w-full md:w-[240px] h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          >
            <option value="">Todas as marcas</option>
            {marcasDisponiveis.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={fCategoria}
            onChange={(e) => setFCategoria(e.target.value)}
            className="w-full md:w-[220px] h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          >
            {CATEGORIAS.map((c) => (
              <option key={c.value || "all"} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <input
            value={fMin}
            onChange={(e) => setFMin(e.target.value)}
            placeholder="Valor mín."
            inputMode="decimal"
            className="w-full md:w-[160px] h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          />

          <input
            value={fMax}
            onChange={(e) => setFMax(e.target.value)}
            placeholder="Valor máx."
            inputMode="decimal"
            className="w-full md:w-[160px] h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          />

          <button
            onClick={onApplyFilters}
            disabled={loading}
            className="h-11 px-6 rounded-2xl border border-black/10 bg-white text-slate-900 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
          >
            Aplicar
          </button>
        </div>
      </section>

      {/* Tabela */}
      <section className="rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Itens</div>
          <div className="text-sm text-slate-600">{totalCount}</div>
        </div>

        {loading ? (
          <div className="px-5 py-6 text-sm text-slate-600">Carregando…</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">ID</th>
                  <th className="text-left font-semibold px-4 py-3">Descrição</th>
                  <th className="text-left font-semibold px-4 py-3">Marca</th>
                  <th className="text-right font-semibold px-4 py-3">Estoque mín.</th>
                  <th className="text-left font-semibold px-4 py-3">Categoria</th>
                  <th className="text-right font-semibold px-4 py-3">Valor</th>
                  <th className="text-right font-semibold px-4 py-3">Ações</th>
                </tr>
              </thead>

              <tbody className="bg-white">
                {items.map((p) => {
                  const isEditing = editingId === p.id

                  return (
                    <tr key={p.id} className="border-t border-black/5 hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-700">{p.codigo ?? "-"}</td>

                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            value={String(editRow.descricao ?? "")}
                            onChange={(e) => setEditRow((s) => ({ ...s, descricao: e.target.value }))}
                            className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                          />
                        ) : (
                          <div className="font-semibold text-slate-900">{p.descricao}</div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            value={String(editRow.marca ?? "")}
                            onChange={(e) => setEditRow((s) => ({ ...s, marca: e.target.value }))}
                            className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                          />
                        ) : (
                          <div className="text-slate-700">{p.marca ?? ""}</div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <input
                            value={String(editRow.estoque_minimo ?? 0)}
                            onChange={(e) =>
                              setEditRow((s) => ({ ...s, estoque_minimo: Number(e.target.value || 0) }))
                            }
                            inputMode="numeric"
                            className="w-[120px] text-right h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                          />
                        ) : (
                          <div className="text-slate-700">{p.estoque_minimo ?? 0}</div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={String(editRow.categoria ?? "")}
                            onChange={(e) => setEditRow((s) => ({ ...s, categoria: e.target.value }))}
                            className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                          >
                            <option value="ração pacote">Ração</option>
                            <option value="ração granel">Ração granel</option>
                            <option value="diversos">Diversos</option>
                          </select>
                        ) : (
                          <div className="text-slate-700">{p.categoria ?? "-"}</div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <input
                            value={numberToBR(Number(editRow.valor ?? 0))}
                            onChange={(e) => setEditRow((s) => ({ ...s, valor: brToNumber(e.target.value) }))}
                            inputMode="decimal"
                            className="w-[140px] text-right h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                          />
                        ) : (
                          <div className="font-semibold text-slate-900">R$ {numberToBR(Number(p.valor ?? 0))}</div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex gap-2 justify-end">
                            <button
                              disabled={savingRow}
                              onClick={() => saveEditRow(p.id)}
                              className="h-10 px-4 rounded-xl bg-[#00D6FF] text-slate-900 text-sm font-semibold disabled:opacity-60"
                            >
                              {savingRow ? "Salvando..." : "Salvar"}
                            </button>
                            <button
                              disabled={savingRow}
                              onClick={cancelEdit}
                              className="h-10 px-4 rounded-xl border border-black/10 bg-white text-slate-900 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(p)}
                            className="h-10 px-4 rounded-xl border border-black/10 bg-white text-slate-900 text-sm font-semibold hover:bg-slate-50"
                          >
                            Editar
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}

                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      Nenhum produto encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
