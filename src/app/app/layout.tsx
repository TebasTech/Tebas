import type { ReactNode } from "react"
import ClientShell from "../client-shell"

export default function AppLayout({ children }: { children: ReactNode }) {
  return <ClientShell>{children}</ClientShell>
}
