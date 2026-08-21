'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, Camera, CheckCircle2, Eye, EyeOff, UserRound } from 'lucide-react'
import { authAPI } from '@/lib/api-client'

const input = 'h-11 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 hover:border-slate-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10'

export default function RegisterPage() {
  const router = useRouter()
  const [photo, setPhoto] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const selectPhoto = (file?: File) => {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return setError('Format non autorisé. Utilisez PNG, JPG, JPEG ou WebP.')
    if (file.size > 2 * 1024 * 1024) return setError('La photo ne doit pas dépasser 2 Mo.')
    const reader = new FileReader()
    reader.onload = () => { setPhoto(String(reader.result)); setError('') }
    reader.readAsDataURL(file)
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    const data = new FormData(event.currentTarget)
    const password = String(data.get('password'))
    const confirmation = String(data.get('confirmation'))
    if (password !== confirmation) {
      setError('Le mot de passe et sa confirmation ne correspondent pas.')
      setLoading(false); return
    }
    const ageText = String(data.get('age') || '')
    const result = await authAPI.register({
      prenom: String(data.get('prenom')).trim(),
      nom: String(data.get('nom')).trim(),
      email: String(data.get('email')).trim(),
      telephone: String(data.get('telephone')).trim() || undefined,
      age: ageText ? Number(ageText) : null,
      sexe: String(data.get('sexe') || '') || null,
      poste: String(data.get('poste') || '') || null,
      photoUrl: photo || null,
      password,
      password_confirmation: confirmation,
    })
    setLoading(false)
    if (!result.success) return setError(result.error || 'Impossible de créer le compte.')
    setSuccess('Compte créé avec succès. Redirection vers la connexion…')
    setTimeout(() => router.push('/login'), 900)
  }

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,.18),transparent_30%),linear-gradient(135deg,#020617,#071328)] px-4 py-6 sm:px-6">
    <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/80 shadow-2xl lg:grid-cols-[.78fr_1.22fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-blue-700 via-cyan-700 to-slate-950 p-9 lg:flex lg:flex-col lg:justify-between">
        <div><img src="/logo.svg" alt="TuniCars+" className="w-64" /><h1 className="mt-12 text-3xl font-black text-white">Créez votre espace professionnel</h1><p className="mt-3 text-sm leading-6 text-cyan-50/80">Toutes vos informations seront immédiatement disponibles dans Mon Profil.</p></div>
        <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-sm text-white backdrop-blur"><CheckCircle2 className="mb-2 text-emerald-300" />Compte sécurisé et informations persistées dans votre espace TuniCars+.</div>
      </aside>

      <section className="overflow-y-auto p-5 sm:p-8 lg:p-10"><div className="mx-auto max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[.25em] text-cyan-400">Inscription</p><h2 className="mt-2 text-3xl font-black text-white">Créer un compte</h2><p className="mt-1 text-sm text-slate-400">Renseignez les informations qui apparaîtront dans votre profil.</p>
        {error && <div className="mt-5 flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"><AlertCircle size={17} className="shrink-0" />{error}</div>}
        {success && <div className="mt-5 flex gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300"><CheckCircle2 size={17} />{success}</div>}

        <form onSubmit={submit} className="mt-6 space-y-5">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-800">{photo ? <img src={photo} alt="Aperçu du profil" className="h-full w-full object-cover" /> : <UserRound size={40} className="text-slate-500" />}</div>
            <div><label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-700 px-3 text-sm font-bold text-slate-200 transition hover:bg-slate-800"><Camera size={16} /> Choisir une photo<input type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => selectPhoto(e.target.files?.[0])} /></label><p className="mt-2 text-xs text-slate-500">PNG, JPG, JPEG ou WebP · 2 Mo maximum</p></div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom *"><input name="prenom" required minLength={2} placeholder="Mohamed" className={input} /></Field>
            <Field label="Nom *"><input name="nom" required minLength={2} placeholder="Gaied" className={input} /></Field>
            <Field label="Adresse e-mail *"><input name="email" type="email" required placeholder="nom@exemple.com" className={input} /></Field>
            <Field label="Téléphone"><input name="telephone" type="tel" pattern="[+0-9 ()-]{6,20}" placeholder="+216 22 000 000" className={input} /></Field>
            <Field label="Âge"><input name="age" type="number" min="0" max="130" placeholder="25" className={input} /></Field>
            <Field label="Sexe"><select name="sexe" className={input}><option value="">Non renseigné</option><option>Homme</option><option>Femme</option></select></Field>
            <Field label="Poste"><select name="poste" className={input}><option value="">Non renseigné</option><option>Administrateur</option><option>Responsable</option><option>Gestionnaire de flotte</option><option>Agent de location</option><option>Employé</option></select></Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordField name="password" label="Mot de passe *" show={showPassword} toggle={() => setShowPassword((v) => !v)} />
            <PasswordField name="confirmation" label="Confirmation *" show={showConfirmation} toggle={() => setShowConfirmation((v) => !v)} />
          </div>
          <button disabled={loading} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50">{loading ? 'Création en cours…' : 'Créer mon compte'}<ArrowRight size={17} /></button>
          <p className="text-center text-sm text-slate-400">Déjà un compte ? <Link href="/login" className="font-bold text-cyan-400 hover:text-cyan-300">Se connecter</Link></p>
        </form>
      </div></section>
    </div>
  </main>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1.5 text-xs font-semibold text-slate-400">{label}{children}</label>
}

function PasswordField({ name, label, show, toggle }: { name: string; label: string; show: boolean; toggle: () => void }) {
  return <Field label={label}><div className="relative"><input name={name} type={show ? 'text' : 'password'} required minLength={8} placeholder="8 caractères minimum" className={`${input} pr-10`} /><button type="button" onClick={toggle} aria-label={show ? 'Masquer' : 'Afficher'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></Field>
}
