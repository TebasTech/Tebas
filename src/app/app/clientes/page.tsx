"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"

type Customer = {
  id: string
  store_id: string | null
  name: string
  phone: string | null
  address: string | null
  neighborhood: string | null
  city: string | null
  created_at: string | null
}

export default function ClientesPage() {
  const router = useRouter()

  const [storeId, setStoreId] = useState<string | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [q, setQ] = useState("")
  const [isOpen, setIsOpen] = useState(false)

  // form
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [neighborhood, setNeighborhood] = useState("")
  const [city, setCity] = useState("")

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

  async function loadCustomers(currentStoreId: string) {
    setErrorMsg(null)
    setLoading(true)

    const { data, error } = await supabase
      .from("customers")
      .select("id, store_id, name, phone, address, neighborhood, city, created_at")
      .eq("store_id", currentStoreId)
      .order("created_at", { ascending: false })
      .limit(2000)

    if (error) {
      setCustomers([])
      setErrorMsg(`Erro ao carregar clientes: ${error.message}`)
      setLoading(false)
      return
    }

    setCustomers((data as Customer[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    ;(async () => {
      const sid = await getStoreIdOrRedirect()
      if (!sid) {
        setLoading(false)
        setCustomers([])
        return
      }
      setStoreId(sid)
      await loadCustomers(sid)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return customers

    return customers.filter((c) => {
      const blob = [
        c.name ?? "",
        c.phone ?? "",
        c.address ?? "",
        c.neighborhood ?? "",
        c.city ?? "",
      ]
        .join(" ")
        .toLowerCase()

      return blob.includes(term)
    })
  }, [customers, q])

  function resetForm() {
    setName("")
    setPhone("")
    setAddress("")
    setNeighborhood("")
    setCity("")
  }

  async function onSaveCustomer() {
    setErrorMsg(null)
    if (!storeId) {
      setErrorMsg("Não foi possível identificar sua loja (store_id).")
      return
    }

    if (!name.trim()) {
      alert("Preencha pelo menos o Nome.")
      return
    }

    setSaving(true)

    const payload = {
      store_id: storeId,
      name: name.trim(),
      phone: phone.trim() ? phone.trim() : null,
      address: address.trim() ? address.trim() : null,
      neighborhood: neighborhood.trim() ? neighborhood.trim() : null,
      city: city.trim() ? city.trim() : null,
    }

    const { data, error } = await supabase
      .from("customers")
      .insert(payload)
      .select("id, store_id, name, phone, address, neighborhood, city, created_at")
      .single()

    if (error) {
      setErrorMsg(`Erro ao salvar cliente: ${error.message}`)
      setSaving(false)
      return
    }

    setCustomers((prev) => [data as Customer, ...prev])

    setIsOpen(false)
    resetForm()
    setSaving(false)
  }

  async function deleteCustomer(id: string) {
    if (!storeId) return
    const ok = confirm("Remover este cliente?")
    if (!ok) return

    setErrorMsg(null)

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", id)
      .eq("store_id", storeId)

    if (error) {
      setErrorMsg(`Erro ao remover cliente: ${error.message}`)
      return
    }

    setCustomers((prev) => prev.filter((c) => c.id !== id))
  }

  async function updateInline(
    id: string,
    patch: Partial<Pick<Customer, "name" | "phone" | "address" | "neighborhood" | "city">>
  ) {
    setErrorMsg(null)
    if (!storeId) return

    // otimista
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))

    const { error } = await supabase
      .from("customers")
      .update(patch)
      .eq("id", id)
      .eq("store_id", storeId)

    if (error) {
      setErrorMsg(`Erro ao atualizar cliente: ${error.message}`)
      await loadCustomers(storeId)
    }
  }

  function exportCSV() {
    const rows = [...customers].sort((a, b) =>
      (a.created_at ?? "") < (b.created_at ?? "") ? -1 : 1
    )

    const header = ["Nome", "Telefone", "Endereço", "Bairro", "Cidade", "Data cadastro"].join(";") + "\n"
    const lines = rows
      .map((c) => {
        return [
          safeCsv(c.name),
          safeCsv(c.phone ?? ""),
          safeCsv(c.address ?? ""),
          safeCsv(c.neighborhood ?? ""),
          safeCsv(c.city ?? ""),
          formatDateTimeBR(c.created_at ?? ""),
        ].join(";")
      })
      .join("\n")

    const blob = new Blob([header + lines], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "clientes.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  function openWhatsApp(phoneRaw: string | null, nameRaw: string) {
    const digits = toDigits(phoneRaw || "")
    if (!digits) return

    // Se o usuário não colocar código do país, a gente tenta usar +55 (padrão BR).
    const full =
      digits.startsWith("55") || digits.length > 11 ? digits : `55${digits}`

    const msg = `Olá ${nameRaw || ""}!`
    const url = `https://wa.me/${full}?text=${encodeURIComponent(msg)}`
    window.open(url, "_blank", "noreferrer")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clientes</h1>
          <p className="text-sm text-slate-600 mt-1">
            Cadastro simples para WhatsApp e histórico.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            onClick={exportCSV}
            className="h-11 px-5 rounded-2xl bg-white border border-black/10 text-slate-900 text-sm font-semibold hover:bg-slate-50 w-full sm:w-auto"
          >
            Exportar Excel
          </button>

          <button
            onClick={() => setIsOpen(true)}
            className="h-11 px-5 rounded-2xl bg-[#22C55E] text-white text-sm font-semibold hover:brightness-95 w-full sm:w-auto"
          >
            Novo cliente
          </button>
        </div>
      </div>

      {errorMsg ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="block md:col-span-2">
          <span className="text-sm font-semibold text-slate-800">Buscar</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Digite: nome, telefone, bairro…"
            className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
          />
        </label>

        <div className="rounded-2xl bg-[#EAF7FF] border border-black/5 p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Clientes</div>
            <div className="text-xs text-slate-600">Filtrados / Total</div>
          </div>
          <div className="text-lg font-semibold text-slate-900">
            {filtered.length} / {customers.length}
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Histórico do cadastro</div>
          <div className="text-xs text-slate-600">Dica: edite direto na tabela e saia do campo.</div>
        </div>

        {loading ? (
          <div className="px-5 py-6 text-sm text-slate-600">Carregando…</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm min-w-[1260px]">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Nome</th>
                  <th className="text-left font-semibold px-4 py-3">Telefone</th>
                  <th className="text-left font-semibold px-4 py-3">Endereço</th>
                  <th className="text-left font-semibold px-4 py-3">Bairro</th>
                  <th className="text-left font-semibold px-4 py-3">Cidade</th>
                  <th className="text-left font-semibold px-4 py-3">Data</th>
                  <th className="text-left font-semibold px-4 py-3">Ações</th>
                </tr>
              </thead>

              <tbody className="bg-white">
                {filtered.length === 0 ? (
                  <tr className="border-t border-black/5">
                    <td className="px-4 py-5 text-slate-600" colSpan={7}>
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => {
                    const phoneDigits = toDigits(c.phone ?? "")
                    const canWhats = Boolean(phoneDigits)

                    return (
                      <tr key={c.id} className="border-t border-black/5 hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <input
                            defaultValue={c.name}
                            onBlur={(e) => updateInline(c.id, { name: e.target.value.trim() || c.name })}
                            className="w-[240px] h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF] font-semibold text-slate-900"
                          />
                        </td>

                        <td className="px-4 py-3">
                          <input
                            defaultValue={c.phone ?? ""}
                            onBlur={(e) =>
                              updateInline(c.id, { phone: e.target.value.trim() ? e.target.value.trim() : null })
                            }
                            placeholder="(xx) xxxxx-xxxx"
                            className="w-[180px] h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF] text-slate-800"
                            inputMode="tel"
                          />
                        </td>

                        <td className="px-4 py-3">
                          <input
                            defaultValue={c.address ?? ""}
                            onBlur={(e) =>
                              updateInline(c.id, { address: e.target.value.trim() ? e.target.value.trim() : null })
                            }
                            placeholder="Rua, nº"
                            className="w-[260px] h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF] text-slate-800"
                          />
                        </td>

                        <td className="px-4 py-3">
                          <input
                            defaultValue={c.neighborhood ?? ""}
                            onBlur={(e) =>
                              updateInline(c.id, {
                                neighborhood: e.target.value.trim() ? e.target.value.trim() : null,
                              })
                            }
                            placeholder="Bairro"
                            className="w-[170px] h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF] text-slate-800"
                          />
                        </td>

                        <td className="px-4 py-3">
                          <input
                            defaultValue={c.city ?? ""}
                            onBlur={(e) =>
                              updateInline(c.id, { city: e.target.value.trim() ? e.target.value.trim() : null })
                            }
                            placeholder="Cidade"
                            className="w-[160px] h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF] text-slate-800"
                          />
                        </td>

                        <td className="px-4 py-3 text-slate-700">{formatDateTimeBR(c.created_at ?? "")}</td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openWhatsApp(c.phone, c.name)}
                              disabled={!canWhats}
                              className="h-10 px-4 rounded-2xl bg-white border border-black/10 text-slate-900 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                            >
                              WhatsApp
                            </button>

                            <button
                              onClick={() => deleteCustomer(c.id)}
                              className="h-10 px-4 rounded-2xl bg-white border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50"
                            >
                              Remover
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => (saving ? null : setIsOpen(false))} />

          <div className="absolute left-1/2 top-1/2 w-[94vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white border border-black/10 shadow-xl">
            <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
              <div>
                <div className="text-base font-semibold text-slate-900">Novo cliente</div>
                <div className="text-xs text-slate-600 mt-1">Telefone e endereço são opcionais.</div>
              </div>

              <button
                onClick={() => (saving ? null : setIsOpen(false))}
                className="h-10 px-4 rounded-2xl bg-white border border-black/10 text-slate-900 text-sm font-semibold hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block md:col-span-2">
                <span className="text-sm font-semibold text-slate-800">Nome *</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: João"
                  className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-sm font-semibold text-slate-800">Telefone</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: (11) 99999-9999"
                  className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                  inputMode="tel"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-sm font-semibold text-slate-800">Endereço</span>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: Rua X, 123"
                  className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Bairro</span>
                <input
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="Ex: Centro"
                  className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Cidade</span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: Arad"
                  className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
                />
              </label>
            </div>

            <div className="px-5 py-4 border-t border-black/5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => (saving ? null : setIsOpen(false))}
                className="h-11 px-5 rounded-2xl bg-white border border-black/10 text-slate-900 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                onClick={onSaveCustomer}
                className="h-11 px-5 rounded-2xl bg-[#22C55E] text-white text-sm font-semibold hover:brightness-95 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function safeCsv(s: string) {
  const t = (s ?? "").replace(/\r?\n/g, " ").trim()
  return t.replace(/;/g, ",")
}

function formatDateTimeBR(iso: string) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, "0")
  const mi = String(d.getMinutes()).padStart(2, "0")
  return `${dd}/${mm}/${yy} ${hh}:${mi}`
}

function toDigits(s: string) {
  return (s ?? "").replace(/\D+/g, "").trim()
}
