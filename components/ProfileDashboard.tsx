'use client'

import { useEffect, useState } from 'react'
import { BriefcaseBusiness, CalendarDays, Camera, CheckCircle2, LockKeyhole, Mail, Phone, Save, ShieldCheck, UserRound, UsersRound, X } from 'lucide-react'
import { authAPI } from '@/lib/api-client'
import type { User } from '@/types'

const field = 'h-11 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-sm text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10'
function lastLoginDisplay(value?: string | null) {
  if (!value) return { exact: 'Première connexion', relative: '' }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { exact: 'Première connexion', relative: '' }
  const exact = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Tunis',
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(date).replace(',', ' à')
  const now = new Date()
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000))
  if (minutes < 1) return { exact, relative: "À l’instant" }
  if (minutes < 60) return { exact, relative: `Il y a ${minutes} minute${minutes > 1 ? 's' : ''}` }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { exact, relative: `Il y a ${hours} heure${hours > 1 ? 's' : ''}` }
  const days = Math.floor(hours / 24)
  return { exact, relative: `Il y a ${days} jour${days > 1 ? 's' : ''}` }
}

export default function ProfileDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null)

  useEffect(() => {
    authAPI.me().then((result) => {
      if (result.data) setUser(result.data)
      else setToast({ text: result.error || 'Impossible de charger le profil', error: true })
      setLoading(false)
    })
  }, [])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  if (loading) return <ProfileSkeleton />
  if (!user) return <div className="m-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">Profil indisponible. Vérifiez votre connexion.</div>
  const lastLogin = lastLoginDisplay(user.last_login)

  return (
    <main className="min-h-full flex-1 bg-[var(--bg)] p-4 sm:p-6 lg:p-8">
      {toast && <div className={`fixed right-5 top-5 z-[70] rounded-xl px-4 py-3 text-sm font-bold text-white shadow-2xl ${toast.error ? 'bg-red-500' : 'bg-emerald-500'}`}>{toast.text}</div>}
      <div className="mx-auto max-w-5xl">
        <header className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-400">Compte utilisateur</p>
          <h1 className="mt-1 text-3xl font-black text-white">Mon Profil</h1>
        </header>

        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/85 shadow-2xl shadow-slate-950/30">
          <div className="h-28 bg-gradient-to-r from-blue-700 via-cyan-600 to-emerald-500" />
          <div className="px-5 pb-6 sm:px-8">
            <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <Avatar user={user} />
                <div className="pb-1">
                  <h2 className="text-2xl font-black text-white">{user.prenom} {user.nom}</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {user.poste || 'Poste non renseigné'}
                    <span className="mx-2 text-slate-600">—</span>
                    <span className="capitalize text-cyan-400">{user.role}</span>
                  </p>
                </div>
              </div>
              <button onClick={() => setEditing(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 text-sm font-bold text-slate-200 transition hover:border-cyan-500/50 hover:bg-cyan-500/10">
                <UserRound size={16} /> Modifier les informations
              </button>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Info icon={Mail} label="Adresse e-mail" value={user.email} />
              <Info icon={Phone} label="Téléphone" value={user.telephone} />
              <Info icon={UsersRound} label="Âge" value={user.age != null ? `${user.age} ans` : null} />
              <Info icon={UserRound} label="Sexe" value={user.sexe} />
              <Info icon={BriefcaseBusiness} label="Poste" value={user.poste} />
              <Info icon={ShieldCheck} label="Rôle" value={user.role} />
              <Info icon={CalendarDays} label="Compte créé le" value={new Intl.DateTimeFormat('fr-FR').format(new Date(user.created_at))} />
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/85 p-5">
          <h3 className="flex items-center gap-2 font-black text-white"><LockKeyhole size={18} className="text-cyan-400" /> Sécurité</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-950/45 p-4"><p className="text-xs text-slate-500">Dernière connexion · heure de Tunis</p><p className="mt-1 text-sm font-semibold text-slate-200">{lastLogin.exact}</p>{lastLogin.relative ? <p className="mt-1 text-xs text-slate-500">{lastLogin.relative}</p> : null}</div>
            <div className="rounded-xl bg-slate-950/45 p-4"><p className="text-xs text-slate-500">Statut du compte</p><p className={`mt-1 inline-flex items-center gap-1 text-sm font-bold ${user.is_active ? 'text-emerald-400' : 'text-red-400'}`}><CheckCircle2 size={14} /> {user.is_active ? 'Actif' : 'Inactif'}</p></div>
          </div>
          <button onClick={() => setPasswordOpen(true)} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-slate-700 px-4 text-sm font-bold text-slate-200 transition hover:bg-slate-800"><LockKeyhole size={15} /> Changer le mot de passe</button>
        </section>
      </div>

      {editing && <EditProfileModal user={user} onClose={() => setEditing(false)} onSaved={(updated) => { setUser(updated); window.dispatchEvent(new CustomEvent<User>('user-profile-updated', { detail: updated })); setEditing(false); setToast({ text: 'Profil enregistré avec succès' }) }} onError={(text) => setToast({ text, error: true })} />}
      {passwordOpen && <PasswordModal onClose={() => setPasswordOpen(false)} onSuccess={() => { setPasswordOpen(false); setToast({ text: 'Mot de passe modifié' }) }} />}
    </main>
  )
}

function Avatar({ user }: { user: User }) {
  return <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-slate-900 bg-slate-800 shadow-xl">
    {user.photoUrl
      // A regular image reliably supports persisted data URLs returned by the API.
      ? <img src={user.photoUrl} alt={`Photo de ${user.prenom} ${user.nom}`} className="h-full w-full object-cover" />
      : <UserRound className="text-slate-500" size={50} />}
  </div>
}

function Info({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value?: string | null }) {
  return <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/45 p-3.5"><Icon size={16} className="mb-2 text-cyan-400" /><p className="text-[11px] text-slate-500">{label}</p><p className="mt-0.5 truncate text-sm font-semibold text-slate-200">{value || 'Non renseigné'}</p></div>
}

function EditProfileModal({ user, onClose, onSaved, onError }: { user: User; onClose: () => void; onSaved: (user: User) => void; onError: (text: string) => void }) {
  const [preview, setPreview] = useState(user.photoUrl || '')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const choosePhoto = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return setFormError('Le fichier sélectionné doit être une image.')
    if (file.size > 2 * 1024 * 1024) return setFormError('La photo ne doit pas dépasser 2 Mo.')
    const reader = new FileReader()
    reader.onload = () => { setPreview(String(reader.result)); setFormError('') }
    reader.readAsDataURL(file)
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true); setFormError('')
    const data = new FormData(event.currentTarget)
    const nom = String(data.get('nom') || '').trim()
    const prenom = String(data.get('prenom') || '').trim()
    if (!nom || !prenom) { setFormError('Le nom et le prénom sont obligatoires.'); setSaving(false); return }
    const ageText = String(data.get('age') || '')
    const result = await authAPI.updateMe({
      nom, prenom,
      email: String(data.get('email') || '').trim(),
      telephone: String(data.get('telephone') || '').trim() || null,
      age: ageText ? Number(ageText) : null,
      sexe: String(data.get('sexe') || '') || null,
      poste: String(data.get('poste') || '').trim() || null,
      photoUrl: preview || null,
    })
    setSaving(false)
    if (result.data) onSaved(result.data)
    else { const message = result.error || 'Impossible d’enregistrer le profil.'; setFormError(message); onError(message) }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4">
    <form onSubmit={submit} className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
      <div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-black text-white">Modifier les informations</h2><p className="text-xs text-slate-500">Les modifications sont enregistrées dans votre compte.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white"><X size={18} /></button></div>
      {formError && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{formError}</div>}
      <div className="mb-5 flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-slate-800">{preview ? <img src={preview} alt="Aperçu" className="h-full w-full object-cover" /> : <UserRound className="text-slate-500" size={40} />}</div>
        <div><label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-700 px-3 text-sm font-bold text-slate-200 hover:bg-slate-800"><Camera size={16} /> Changer la photo<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => choosePhoto(e.target.files?.[0])} /></label><p className="mt-2 text-xs text-slate-500">PNG, JPG ou WebP, maximum 2 Mo.</p></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-400">Prénom *<input name="prenom" required defaultValue={user.prenom} className={`${field} mt-1.5`} /></label>
        <label className="text-xs text-slate-400">Nom *<input name="nom" required defaultValue={user.nom} className={`${field} mt-1.5`} /></label>
        <label className="text-xs text-slate-400">Adresse e-mail<input name="email" type="email" required defaultValue={user.email} className={`${field} mt-1.5`} /></label>
        <label className="text-xs text-slate-400">Téléphone<input name="telephone" type="tel" defaultValue={user.telephone || ''} className={`${field} mt-1.5`} /></label>
        <label className="text-xs text-slate-400">Âge<input name="age" type="number" min="0" max="130" defaultValue={user.age ?? ''} className={`${field} mt-1.5`} /></label>
        <label className="text-xs text-slate-400">Sexe<select name="sexe" defaultValue={user.sexe || ''} className={`${field} mt-1.5`}><option value="">Non renseigné</option><option>Homme</option><option>Femme</option><option>Autre</option></select></label>
        <label className="text-xs text-slate-400 sm:col-span-2">Poste<select name="poste" defaultValue={user.poste || ''} className={`${field} mt-1.5`}><option value="">Non renseigné</option><option>Administrateur</option><option>Responsable</option><option>Agent de location</option><option>Gestionnaire de flotte</option><option>Employé</option></select></label>
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-slate-800 pt-4"><button type="button" onClick={onClose} disabled={saving} className="action-button">Annuler</button><button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-500 px-4 text-sm font-bold text-slate-950 disabled:opacity-50"><Save size={15} /> {saving ? 'Enregistrement…' : 'Enregistrer'}</button></div>
    </form>
  </div>
}

function PasswordModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError('')
    const data = new FormData(event.currentTarget), next = String(data.get('new'))
    if (next !== String(data.get('confirm'))) { setError('La confirmation ne correspond pas.'); setSaving(false); return }
    const result = await authAPI.changePassword({ current_password: String(data.get('current')), new_password: next })
    setSaving(false); if (result.success) onSuccess(); else setError(result.error || 'Modification impossible.')
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"><form onSubmit={submit} className="w-full max-w-md space-y-3 rounded-2xl border border-slate-700 bg-slate-900 p-5"><h2 className="text-xl font-black">Changer le mot de passe</h2>{error && <p className="rounded-lg bg-red-500/10 p-2 text-sm text-red-300">{error}</p>}<input name="current" type="password" required placeholder="Mot de passe actuel" className={field} /><input name="new" type="password" minLength={8} required placeholder="Nouveau mot de passe" className={field} /><input name="confirm" type="password" minLength={8} required placeholder="Confirmation" className={field} /><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={onClose} className="action-button">Annuler</button><button disabled={saving} className="h-10 rounded-lg bg-cyan-500 px-4 text-sm font-bold text-slate-950 disabled:opacity-50">{saving ? 'Modification…' : 'Modifier'}</button></div></form></div>
}

function ProfileSkeleton() {
  return <div className="mx-auto max-w-5xl p-6"><div className="mb-5 h-8 w-52 animate-pulse rounded bg-slate-800" /><div className="h-96 animate-pulse rounded-3xl bg-slate-900" /><div className="mt-5 h-44 animate-pulse rounded-2xl bg-slate-900" /></div>
}
