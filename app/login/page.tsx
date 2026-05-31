"use client"

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('klose.gaied@gamil.com')
  const [password, setPassword] = useState('dhia21')
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    // Simple static check (development only)
    const norm = email.replace(/\s+/g, '').toLowerCase()
    if ((norm === 'klose.gaied@gamil.com' || norm === 'klose.gaied@gmail.com') && password === 'dhia21') {
      try { localStorage.setItem('isLoggedIn', 'true') } catch {}
      window.location.href = '/'
    } else {
      setError("Email ou mot de passe incorrect")
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#020617_0%,#071028_100%)] flex items-center justify-center">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="w-full max-w-7xl mx-auto p-6">
        <div className="bg-[#0f172a] rounded-2xl overflow-hidden shadow-2xl grid grid-cols-1 md:grid-cols-2">

          {/* LEFT - Branding */}
          <div className="relative hidden md:flex flex-col justify-between p-10 bg-cover" style={{ backgroundImage: `url('/login-side.jpg')` }}>
            <div className="absolute inset-0 bg-gradient-to-br from-black/30 to-transparent"></div>
            <div className="relative z-10">
              <img src="/logo.png" alt="TuniCars+" className="w-40 mb-6" />
              <h2 className="text-3xl font-bold text-white leading-tight mb-3">Gérez votre flotte de voitures en toute simplicité</h2>
              <p className="text-sm text-[#94a3b8] max-w-md">Solution complète de gestion de location de voitures, performante, sécurisée et intuitive.</p>
            </div>

            <div className="relative z-10 flex gap-6 text-white/90">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/5 rounded-lg backdrop-blur-sm shadow-inner transform transition-transform hover:-translate-y-1">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7h18M3 12h18M3 17h18" /></svg>
                </div>
                <div>
                  <div className="text-sm font-semibold">Gestion véhicules</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/5 rounded-lg backdrop-blur-sm shadow-inner transform transition-transform hover:-translate-y-1">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3" /></svg>
                </div>
                <div>
                  <div className="text-sm font-semibold">Sécurité données</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/5 rounded-lg backdrop-blur-sm shadow-inner transform transition-transform hover:-translate-y-1">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7h18M3 12h18M3 17h18" /></svg>
                </div>
                <div>
                  <div className="text-sm font-semibold">Statistiques temps réel</div>
                </div>
              </div>
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
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94a3b8]"><Mail size={18}/></div>
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="votre@email.com" className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#071027] border border-[#1e293b] text-white placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-shadow" />
                </div>

                <div className="relative">
                  <label className="sr-only">Mot de passe</label>
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94a3b8]"><Lock size={18}/></div>
                  <input type={show? 'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mot de passe" className="w-full pl-12 pr-12 py-3 rounded-xl bg-[#071027] border border-[#1e293b] text-white placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#2563eb] transition-shadow" />
                  <button type="button" onClick={()=>setShow(s=>!s)} className="absolute right-3 top-2.5 text-[#94a3b8]">{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                </div>

                {error && <div className="text-sm text-red-400">{error}</div>}

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-[#94a3b8]"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} className="w-4 h-4"/> Se souvenir de moi</label>
                  <a className="text-sm text-[#2563eb] hover:underline">Mot de passe oublié ?</a>
                </div>

                <button type="submit" className="w-full py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-[#2563eb] to-[#4f46e5] shadow-lg hover:scale-[1.01] transform transition">Se connecter →</button>

                <div className="text-center text-sm text-[#94a3b8]">ou</div>

                <button type="button" className="w-full py-2 rounded-xl border border-[#1e293b] bg-transparent flex items-center justify-center gap-3 text-white">
                  <img src="/google.svg" alt="Google" className="w-5 h-5"/> Se connecter avec Google
                </button>

                <p className="text-center text-sm text-[#94a3b8] mt-4">Pas encore de compte ? <Link href="/register" className="text-[#2563eb] hover:underline">Créer un compte</Link></p>
              </form>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

