"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, EyeOff, KeyRound, Mail, User } from 'lucide-react'

import { authAPI, authStorage } from '@/lib/api-client'

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    const result = await authAPI.login({
      identifier,
      password,
    })

    setLoading(false)

    if (!result.success || !result.data) {
      setError(result.error || 'Identifiants incorrects')
      return
    }

    authStorage.setToken(result.data.access_token)
    try {
      sessionStorage.setItem('show-login-welcome', '1')
    } catch {
      // The login remains valid when browser storage is unavailable.
    }
    setMessage('Connexion réussie')
    router.replace('/')
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#020617_0%,#071028_100%)] flex items-center justify-center">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="w-full max-w-7xl mx-auto p-6">
        <div className="bg-[#0f172a] rounded-2xl overflow-hidden shadow-2xl grid grid-cols-1 md:grid-cols-2">

          {/* LEFT - Branding */}
          <div className="relative hidden md:flex flex-col justify-between p-10 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.55),_transparent_40%),linear-gradient(135deg,_#0b1220_0%,_#111d3a_100%)]">
            <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(255,255,255,0.08),transparent_35%)]"></div>
            <div className="relative z-10">
              <img src="/logo.svg" alt="TuniCars+" className="mb-6 w-full max-w-[420px]" />
              <h2 className="text-3xl font-bold text-white leading-tight mb-3">Gérez votre flotte de voitures en toute simplicité</h2>
              <p className="text-sm text-[#94a3b8] max-w-md">Solution complète de gestion de location de voitures, performante, sécurisée et intuitive.</p>
            </div>

            <div className="relative z-10 rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-white/90 backdrop-blur-sm">
             tableau de bord pour gérer vos locations, vos véhicules et vos locataires.
            </div>
          </div>

          {/* RIGHT - Login Card */}
          <div className="p-8 md:p-12 flex items-center justify-center">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="w-full max-w-md">
              <h3 className="text-3xl font-semibold text-white mb-2">Connexion</h3>
              <p className="text-sm text-[#94a3b8] mb-6">Bienvenue ! Connectez-vous à votre espace.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <label className="sr-only">Adresse e-mail</label>
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94a3b8]"><User size={18}/></div>
                  <input type="text" value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="username ou email" className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#071027] border border-[#1e293b] text-white placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-shadow" required />
                </div>

                <div className="relative">
                  <label className="sr-only">Mot de passe</label>
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94a3b8]"><KeyRound size={18}/></div>
                  <input type={show? 'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mot de passe" className="w-full pl-12 pr-12 py-3 rounded-xl bg-[#071027] border border-[#1e293b] text-white placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-shadow" required />
                  <button type="button" onClick={()=>setShow(s=>!s)} className="absolute right-3 top-2.5 text-[#94a3b8]">{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                </div>

                {message && <div className="text-sm text-emerald-400">{message}</div>}
                {error && <div className="text-sm text-red-400">{error}</div>}

                <button type="submit" disabled={loading} className="w-full py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-[#2563eb] to-[#4f46e5] shadow-lg hover:scale-[1.01] transform transition disabled:opacity-60 disabled:cursor-not-allowed">{loading ? 'Connexion...' : 'Se connecter →'}</button>

                <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-[#64748b]">
                  <div className="h-px flex-1 bg-[#1e293b]" />
                  <span>ou</span>
                  <div className="h-px flex-1 bg-[#1e293b]" />
                </div>



                <p className="text-center text-sm text-[#94a3b8] mt-4">Pas encore de compte ? <Link href="/register" className="text-[#2563eb] hover:underline">Créer un compte</Link></p>
              </form>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

