export default function LojaPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Loja</h1>
          <p className="text-sm text-slate-600 mt-1">
            Dados básicos da loja e configurações principais.
          </p>
        </div>

        <button className="h-11 px-5 rounded-2xl bg-[#00D6FF] text-slate-900 text-sm font-semibold hover:brightness-95">
          Salvar alterações
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card: Identificação */}
        <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-900">
            Identificação
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Informações que aparecem nos relatórios e no sistema.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome da loja" defaultValue="Casa de Ração do Randrey" />
            <Field label="Telefone" defaultValue="+55 (xx) xxxxx-xxxx" />
            <Field label="Endereço" defaultValue="Rua / Número / Bairro" />
            <Field label="Cidade" defaultValue="Arad" />
          </div>
        </section>

        {/* Card: Resumo rápido */}
        <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Resumo</h2>
          <p className="text-sm text-slate-600 mt-1">
            Visão rápida para o dono bater o olho.
          </p>

          <div className="mt-5 space-y-3">
            <Stat label="Produtos cadastrados" value="0" />
            <Stat label="Clientes cadastrados" value="0" />
            <Stat label="Vendas hoje" value="R$ 0,00" />
          </div>

          <div className="mt-5 rounded-2xl bg-[#EAF7FF] border border-black/5 p-4">
            <p className="text-sm text-slate-700">
              Dica: comece cadastrando seus produtos e fornecedores. Depois, as
              vendas já começam a baixar o estoque automaticamente.
            </p>
          </div>
        </section>
      </div>

      {/* Card: Usuários (MVP visual) */}
      <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Usuários</h2>
            <p className="text-sm text-slate-600 mt-1">
              Quem pode acessar esta loja (MVP: apenas visual).
            </p>
          </div>
          <button className="h-11 px-5 rounded-2xl bg-white border border-black/10 text-slate-900 text-sm font-semibold hover:bg-slate-50">
            + Adicionar usuário
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-black/5">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Nome</th>
                <th className="text-left font-semibold px-4 py-3">E-mail</th>
                <th className="text-left font-semibold px-4 py-3">Perfil</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              <tr className="border-t border-black/5">
                <td className="px-4 py-3 font-medium text-slate-900">Randrey</td>
                <td className="px-4 py-3 text-slate-700">randrey@exemplo.com</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-[#BFEAFF] border border-[#7DD9FF] px-3 py-1 text-xs font-semibold text-slate-900">
                    Dono
                  </span>
                </td>
              </tr>
              <tr className="border-t border-black/5">
                <td className="px-4 py-3 font-medium text-slate-900">
                  Funcionário
                </td>
                <td className="px-4 py-3 text-slate-700">func@exemplo.com</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-slate-100 border border-black/10 px-3 py-1 text-xs font-semibold text-slate-700">
                    Operador
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Field({
  label,
  defaultValue,
}: {
  label: string
  defaultValue?: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <input
        defaultValue={defaultValue}
        className="mt-2 w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#00D6FF]"
      />
    </label>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50 border border-black/5 px-4 py-3">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  )
}
