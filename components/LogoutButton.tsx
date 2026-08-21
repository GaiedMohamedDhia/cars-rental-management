"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { authStorage } from "@/lib/api-client"

export default function LogoutButton({ className = "" }: { className?: string }) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  function handleLogout() {
    authStorage.clearToken()
    router.push("/login")
    router.refresh()
  }

  if (!mounted || !authStorage.getToken()) {
    return null
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={`text-sm font-medium text-red-300 hover:text-red-200 hover:underline ${className}`}
    >
      Déconnexion
    </button>
  )
}