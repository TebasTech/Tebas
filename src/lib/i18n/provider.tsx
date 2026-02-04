// src/lib/i18n/provider.tsx
"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { Dict, Lang } from "./translations"
import { MESSAGES } from "./translations"

type I18nContextValue = {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

const STORAGE_KEY = "tebas_lang"

function safeLang(v: any): Lang {
  return v === "en" || v === "ro" || v === "pt-BR" ? v : "pt-BR"
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("pt-BR")

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setLangState(safeLang(saved))
    } catch {}
  }, [])

  function setLang(l: Lang) {
    const next = safeLang(l)
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {}
  }

  const dict: Dict = useMemo(() => MESSAGES[lang] || MESSAGES["pt-BR"], [lang])

  function t(key: string) {
    return dict[key] ?? MESSAGES["pt-BR"][key] ?? key
  }

  const value = useMemo(() => ({ lang, setLang, t }), [lang, dict])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>")
  return ctx
}
