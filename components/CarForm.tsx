'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, ImageOff, LoaderCircle, Save, Trash2, X } from 'lucide-react'
import { carsAPI } from '@/lib/api-client'
import type { Car, CreateCarInput } from '@/types'

type Errors = Record<string, string>
const control = 'h-11 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-sm text-white outline-none transition hover:border-slate-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15'

export function VehicleForm({ car }: { car?: Car }) {
  const router = useRouter()
  const [photo, setPhoto] = useState(car?.photoUrl || '')
  const [errors, setErrors] = useState<Errors>({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)

  const choosePhoto = (file?: File) => {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return setErrors((e) => ({ ...e, photo: 'Formats autorisés : PNG, JPG, JPEG et WebP.' }))
    if (file.size > 3 * 1024 * 1024) return setErrors((e) => ({ ...e, photo: 'La photo ne doit pas dépasser 3 Mo.' }))
    const reader = new FileReader()
    reader.onload = () => { setPhoto(String(reader.result)); setErrors((e) => ({ ...e, photo: '' })) }
    reader.readAsDataURL(file)
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values = {
      numImma: String(form.get('numImma') || '').trim(),
      marque: String(form.get('marque') || '').trim(),
      modele: String(form.get('modele') || '').trim(),
      annee: form.get('annee') ? Number(form.get('annee')) : null,
      kilometrage: Number(form.get('kilometrage')),
      prixLocation: Number(form.get('prixLocation')),
      nombrePlaces: form.get('nombrePlaces') ? Number(form.get('nombrePlaces')) : null,
    }
    const nextErrors: Errors = {}
    if (!values.numImma) nextErrors.numImma = 'L’immatriculation est obligatoire.'
    if (!values.marque) nextErrors.marque = 'La marque est obligatoire.'
    if (!values.modele) nextErrors.modele = 'Le modèle est obligatoire.'
    if (values.annee && (values.annee < 1886 || values.annee > 2100)) nextErrors.annee = 'Saisissez une année valide.'
    if (!Number.isFinite(values.kilometrage) || values.kilometrage < 0) nextErrors.kilometrage = 'Le kilométrage doit être positif.'
    if (!Number.isFinite(values.prixLocation) || values.prixLocation <= 0) nextErrors.prixLocation = 'Le prix doit être supérieur à zéro.'
    if (values.nombrePlaces !== null && (values.nombrePlaces < 1 || values.nombrePlaces > 100)) nextErrors.nombrePlaces = 'Le nombre de places est invalide.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSaving(true); setServerError('')
    const data: CreateCarInput = {
      ...values,
      photoUrl: photo || null,
      carburant: String(form.get('carburant') || '') || null,
      transmission: String(form.get('transmission') || '') || null,
      couleur: String(form.get('couleur') || '').trim() || null,
      categorie: String(form.get('categorie') || '') || null,
      etat: Number(form.get('etat')),
    }
    const result = car ? await carsAPI.update(car.id, data) : await carsAPI.create(data)
    if (result.success) { router.push('/cars'); router.refresh(); return }
    setServerError(result.error || 'Enregistrement impossible.')
    setSaving(false)
  }

  return <form onSubmit={submit} noValidate className="space-y-6">
    {serverError && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{serverError}</div>}
    <div className="grid gap-5 md:grid-cols-[220px_1fr]">
      <div className="flex h-[150px] w-[220px] max-w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 p-2 shadow-lg shadow-black/20">{photo ? <img src={photo} alt="Aperçu du véhicule" className="h-full w-full object-contain" /> : <div className="grid h-full place-items-center"><ImageOff className="text-slate-600" size={30} /></div>}</div>
      <div className="flex flex-col justify-center"><p className="mb-2 text-sm font-bold text-slate-200">Photo du véhicule</p><div className="flex flex-wrap gap-2"><label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-700 px-3 text-sm font-bold text-slate-200 hover:bg-slate-800"><Camera size={16} /> Choisir une photo<input type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => choosePhoto(e.target.files?.[0])} /></label>{photo && <button type="button" onClick={() => setPhoto('')} className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-500/20 px-3 text-sm font-bold text-red-400 hover:bg-red-500/10"><Trash2 size={15} /> Supprimer</button>}</div><p className="mt-2 text-xs text-slate-500">PNG, JPG, JPEG ou WebP · 3 Mo maximum. L’image est enregistrée avec le véhicule.</p><ErrorText text={errors.photo} /></div>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Immatriculation *" error={errors.numImma}><input name="numImma" defaultValue={car?.numImma} className={control} /></Field>
      <Field label="Année" error={errors.annee}><input name="annee" type="number" defaultValue={car?.annee ?? ''} className={control} /></Field>
      <Field label="Marque *" error={errors.marque}><input name="marque" defaultValue={car?.marque} className={control} /></Field>
      <Field label="Modèle *" error={errors.modele}><input name="modele" defaultValue={car?.modele} className={control} /></Field>
      <Field label="Kilométrage (km) *" error={errors.kilometrage}><input name="kilometrage" type="number" defaultValue={car?.kilometrage ?? 0} className={control} /></Field>
      <Field label="Prix par jour (DT) *" error={errors.prixLocation}><input name="prixLocation" type="number" step=".01" defaultValue={car?.prixLocation ?? ''} className={control} /></Field>
      <Select label="Carburant" name="carburant" value={car?.carburant} options={['Essence','Diesel','Hybride','Électrique','GPL']} />
      <Select label="Transmission" name="transmission" value={car?.transmission} options={['Manuelle','Automatique','Semi-automatique']} />
      <Field label="Nombre de places" error={errors.nombrePlaces}><input name="nombrePlaces" type="number" defaultValue={car?.nombrePlaces ?? ''} className={control} /></Field>
      <Field label="Couleur"><input name="couleur" defaultValue={car?.couleur ?? ''} className={control} /></Field>
      <Select label="Catégorie" name="categorie" value={car?.categorie} options={['Citadine','Berline','SUV','Utilitaire','Monospace','Coupé','Cabriolet',]} />
      <Select label="Statut du véhicule" name="etat" value={String(car?.etat ?? 0)} options={['Disponible','Louée','En maintenance','Indisponible']} optionValues={['0','1','2','3']} allowEmpty={false} />
    </div>
    <div className="flex flex-col-reverse gap-2 border-t border-slate-800 pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={() => router.back()} className="action-button h-11 px-4"><X size={16} /> Annuler</button><button disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 text-sm font-bold text-white disabled:opacity-50">{saving ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}{saving ? 'Enregistrement…' : 'Enregistrer'}</button></div>
  </form>
}

export const CarForm = VehicleForm
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className="space-y-1.5 text-sm font-medium text-slate-200">{label}{children}<ErrorText text={error} /></label> }
function ErrorText({ text }: { text?: string }) { return text ? <span className="block text-xs text-red-400">{text}</span> : null }
function Select({ label, name, value, options, optionValues, allowEmpty = true }: { label:string;name:string;value?:string|null;options:string[];optionValues?:string[];allowEmpty?:boolean }) { return <label className="space-y-1.5 text-sm font-medium text-slate-200">{label}<select name={name} defaultValue={value || (allowEmpty ? '' : optionValues?.[0])} className={control}>{allowEmpty && <option value="">Non renseigné</option>}{options.map((item,index)=><option key={item} value={optionValues?.[index] ?? item}>{item}</option>)}</select></label> }
