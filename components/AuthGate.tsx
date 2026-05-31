"use client"

import { useEffect, useState } from "react"

const VALID_EMAILS = [
  "klose.gaied@gamil.com",
  "klose.gaied@gmail.com",
]
const VALID_PASSWORD = "dhia21"

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [email, setEmail] = useState("klose.gaied@gamil.com")
  const [password, setPassword] = useState(VALID_PASSWORD)
  const [error, setError] = useState("")

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        const v = localStorage.getItem("isLoggedIn")
        setAuthed(v === "true")
      } catch {
        setAuthed(false)
      }
    })
    return () => cancelAnimationFrame(id)
  }, [])

  if (authed === null) return null

  function normalizeEmail(raw: string) {
    return raw.replace(/\s+/g, "").toLowerCase()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const norm = normalizeEmail(email)
    if (VALID_EMAILS.includes(norm) && password === VALID_PASSWORD) {
      try {
        localStorage.setItem("isLoggedIn", "true")
      } catch (e) {
        // ignore
      }
      setAuthed(true)
    } else {
      setError("Identifiants invalides — vérifiez l'email et le mot de passe")
    }
  }

  function handleLogout() {
    try {
      localStorage.removeItem("isLoggedIn")
    } catch (e) {}
    setAuthed(false)
  }

  if (authed) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex justify-end p-4">
          <button onClick={handleLogout} className="text-sm text-[var(--muted)] hover:underline">Se déconnecter</button>
        </div>
        {children}
      </div>
    )
  }

  // Full-screen modern split login (left image, right form)
  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-[#07101a] to-[#0b1220] flex items-center justify-center">
      <div className="w-full max-w-6xl h-[80vh] bg-[rgba(255,255,255,0.02)] rounded-2xl overflow-hidden shadow-lg grid grid-cols-1 md:grid-cols-2">
        <div className="relative hidden md:block bg-cover bg-center" style={{ backgroundImage: `url('/login-side.jpg')` }}>
          <div className="absolute inset-0 bg-black/40"></div>
          <div className="absolute inset-0 p-10 flex flex-col justify-between text-white">
            <div>
              <img src="/logo.png" alt="logo" className="w-40 mb-6" />
              <h2 className="text-3xl font-bold">Gérez votre flotte de voitures en toute simplicité</h2>
              <p className="mt-4 text-sm text-white/80">Solution complète de gestion de location de voitures, performante, sécurisée et intuitive.</p>
            </div>
            <div className="flex gap-6 text-sm text-white/80">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7h18M3 12h18M3 17h18" /></svg>
                Gestion facile
              </div>
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3" /></svg>
                Statistiques
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 md:p-12 flex items-center justify-center bg-[var(--card)]">
          <div className="w-full max-w-md">
            <h3 className="text-3xl font-semibold mb-2">Connexion</h3>
            <p className="text-sm text-[var(--muted)] mb-6">Bienvenue ! Connectez-vous à votre espace.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Adresse e-mail</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 rounded-lg border border-[var(--border)] bg-transparent" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Mot de passe</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 rounded-lg border border-[var(--border)] bg-transparent" />
              </div>

              {error && <div className="text-sm text-red-500">{error}</div>}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><input type="checkbox" id="remember" className="w-4 h-4"/><label htmlFor="remember" className="text-sm text-[var(--muted)]">Se souvenir de moi</label></div>
                <a className="text-sm text-blue-400 hover:underline">Mot de passe oublié ?</a>
              </div>

              <button type="submit" className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium">Se connecter →</button>

              <div className="text-center text-sm text-[var(--muted)]">ou</div>

              <button type="button" className="w-full py-2 border rounded-lg flex items-center justify-center gap-3">
                <img src="/google.svg" alt="google" className="w-5 h-5"/> Se connecter avec Google
              </button>

              <p className="text-center text-sm text-[var(--muted)] mt-4">Pas encore de compte ? <a href="/register" className="text-blue-400 underline">Créer un compte</a></p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
