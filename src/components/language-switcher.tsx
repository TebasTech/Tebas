// src/components/language-switcher.tsx
"use client"

import { useMemo, useState } from "react"
import { LANGS, type Lang } from "@/lib/i18n/translations"
import { useI18n } from "@/lib/i18n/provider"

export default function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n()
  const [open, setOpen] = useState(false)

  const current = useMemo(() => LANGS.find((x) => x.code === lang) ?? LANGS[0], [lang])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-11 w-11 rounded-full bg-white border border-black/10 shadow-sm hover:bg-slate-50 flex items-center justify-center"
        aria-label={t("lang.switch")}
        title={t("lang.switch")}
      >
        <span className="text-xl leading-none">{current.flag}</span>
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-black/10 shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 text-xs font-semibold text-slate-600 border-b border-black/5">
            {t("lang.switch")}
          </div>

          {LANGS.map((opt) => (
            <button
              key={opt.code}
              type="button"
              onClick={() => {
                setLang(opt.code as Lang)
                setOpen(false)
              }}
              className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center gap-3 ${
                opt.code === lang ? "bg-slate-50" : ""
              }`}
            >
              <span className="text-lg leading-none">{opt.flag}</span>
              <span className="font-semibold text-slate-900">{opt.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
