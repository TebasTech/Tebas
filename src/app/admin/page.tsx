export default function AdminPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Admin</h1>
          <p className="text-sm text-slate-600 mt-1">
            Painel master: escolha uma loja e ajude o cliente a administrar tudo em um só lugar.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SelectLoja />
          <button className="h-11 px-5 rounded-2xl bg-[#00D6FF] text-slate-900 text-sm font-semibold hover:brightness-95">
            Abrir loja selecionada
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi title="Receita (mês)" value="R$ 0,00" hint="Total de vendas no mês atual" />
        <Kpi title="Lucro estimado" value="R$ 0,00" hint="Venda - custo (estimado)" />
        <Kpi title="Estoque baixo" value="0 itens" hint="Produtos abaixo do mínimo" />
        <Kpi title="Clientes" value="0" hint="Clientes cadastrados" />
      </div>

      {/* Conteúdo principal */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Ações rápidas */}
        <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Ações rápidas</h2>
          <p className="text-sm text-slate-600 mt-1">
            Para você resolver as dores do cliente rápido (mobile friendly).
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3">
            <ActionButton label="Cadastrar produto" />
            <ActionButton label="Registrar venda" />
            <ActionButton label="Dar entrada em compra" />
            <ActionButton label="Cadastrar cliente" />
            <ActionButton label="Ver itens com estoque baixo" />
          </div>
        </section>

        {/* Últimas vendas (placeholder) */}
        <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Últimas vendas</h2>
              <p className="text-sm text-slate-600 mt-1">
                Aqui você vai enxergar o que está acontecendo agora na loja.
              </p>
            </div>

            <button className="h-11 px-5 rounded-2xl bg-white border border-black/10 text-slate-900 text-sm font-semibold hover:bg-slate-50">
              Ver todas
            </button>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-black/5">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Data</th>
                  <th className="text-left font-semibold px-4 py-3">Cliente</th>
                  <th className="text-left font-semibold px-4 py-3">Itens</th>
                  <th className="text-right font-semibold px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                <tr className="border-t border-black/5">
                  <td className="px-4 py-3 text-slate-700">—</td>
                  <td className="px-4 py-3 text-slate-700">—</td>
                  <td className="px-4 py-3 text-slate-700">—</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">—</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-5 rounded-2xl bg-[#EAF7FF] border border-black/5 p-4">
            <p className="text-sm text-slate-700">
              Próximo passo: quando conectarmos o banco (Supabase), esse painel vai filtrar por loja e mostrar vendas,
              estoque baixo, lucro e clientes automaticamente.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}

function SelectLoja() {
  return (
    <div className="w-full sm:w-[260px]">
      <label className="block text-sm font-semibold text-slate-800 mb-2">
        Loja selecionada
      </label>
      <select className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]">
        <option>Casa de Ração do Randrey</option>
        <option>Mercadinho do Bairro</option>
        <option>Pet Shop Central</option>
      </select>
    </div>
  )
}

function Kpi({
  title,
  value,
  hint,
}: {
  title: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-800">{title}</div>
      <div className="text-2xl font-semibold text-slate-900 mt-2">{value}</div>
      <div className="text-xs text-slate-600 mt-2">{hint}</div>
    </div>
  )
}

function ActionButton({ label }: { label: string }) {
  return (
    <button className="h-12 w-full rounded-2xl bg-[#BFEAFF] border border-[#7DD9FF] text-slate-900 font-semibold text-sm hover:bg-[#AEE3FF] transition">
      {label}
    </button>
  )
}
