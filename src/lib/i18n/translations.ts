// src/lib/i18n/translations.ts
export type Lang = "pt-BR" | "en" | "ro"

export type Dict = Record<string, string>

export const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: "pt-BR", label: "Português (BR)", flag: "🇧🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "ro", label: "Română", flag: "🇷🇴" },
]

// ✅ Dicionário inicial: cobre Sidebar/Topbar e botões mais comuns.
// A regra é: se um texto aparece na UI, cria uma key aqui e usa t("key").
export const MESSAGES: Record<Lang, Dict> = {
  "pt-BR": {
    // App
    "app.brand": "Tebas Tech",
    "app.account": "Conta",

    // Sidebar
    "nav.store": "Loja",
    "nav.stock": "Estoque",
    "nav.products": "Produtos",
    "nav.customers": "Clientes",
    "nav.sales": "Vendas",
    "nav.finance": "Compras & Despesas",
    "nav.marketing": "Marketing",
    "nav.stats": "Estatísticas",
    "nav.help": "Ajuda",

    // Common
    "common.search": "Buscar…",
    "common.refresh": "Atualizar",
    "common.save": "Salvar",
    "common.cancel": "Cancelar",
    "common.close": "Fechar",
    "common.new": "Novo",
    "common.remove": "Remover",
    "common.loading": "Carregando…",

    // Language
    "lang.switch": "Idioma",
  },

  en: {
    "app.brand": "Tebas Tech",
    "app.account": "Account",

    "nav.store": "Store",
    "nav.stock": "Stock",
    "nav.products": "Products",
    "nav.customers": "Customers",
    "nav.sales": "Sales",
    "nav.finance": "Purchases & Expenses",
    "nav.marketing": "Marketing",
    "nav.stats": "Statistics",
    "nav.help": "Help",

    "common.search": "Search…",
    "common.refresh": "Refresh",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.close": "Close",
    "common.new": "New",
    "common.remove": "Remove",
    "common.loading": "Loading…",

    "lang.switch": "Language",
  },

  ro: {
    "app.brand": "Tebas Tech",
    "app.account": "Cont",

    "nav.store": "Magazin",
    "nav.stock": "Stoc",
    "nav.products": "Produse",
    "nav.customers": "Clienți",
    "nav.sales": "Vânzări",
    "nav.finance": "Achiziții & Cheltuieli",
    "nav.marketing": "Marketing",
    "nav.stats": "Statistici",
    "nav.help": "Ajutor",

    "common.search": "Căutare…",
    "common.refresh": "Actualizează",
    "common.save": "Salvează",
    "common.cancel": "Anulează",
    "common.close": "Închide",
    "common.new": "Nou",
    "common.remove": "Șterge",
    "common.loading": "Se încarcă…",

    "lang.switch": "Limba",
  },
}
