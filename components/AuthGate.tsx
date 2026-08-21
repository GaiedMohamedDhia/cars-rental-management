"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { authAPI, authStorage } from "@/lib/api-client"

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const isAuthPage = pathname === "/login" || pathname === "/register"

  useEffect(() => {
    let cancelled = false
    const token = authStorage.getToken()
    if (!token) {
      setAuthed(false)
      if (!isAuthPage) router.replace("/login")
      return () => { cancelled = true }
    }
    authAPI.me().then((result) => {
      if (cancelled) return
      if (!result.success) {
        if (result.status === 401 || result.status === 403) {
          authStorage.clearToken()
          setAuthed(false)
          if (!isAuthPage) router.replace("/login")
        } else {
          // Keep a persisted session during a temporary API/network failure.
          setAuthed(true)
        }
        return
      }
      setAuthed(true)
      if (isAuthPage) router.replace("/")
    }).catch(() => {
      if (!cancelled) setAuthed(true)
    })
    return () => { cancelled = true }
  }, [isAuthPage, router])

  if (authed === null) return null
  if (isAuthPage) return <>{children}</>
  if (authed) return <div className="min-h-screen flex flex-col">{children}</div>
  return <>{children}</>
}
