'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, ImagePlus, Trash2, UserRound } from 'lucide-react'
import { rentersAPI } from '@/lib/api-client'
import { resolveMediaUrl } from '@/lib/media-url'
import type { Renter } from '@/types'

interface RenterFormProps {
  renter?: Renter
}

export function RenterForm({ renter }: RenterFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(resolveMediaUrl(renter?.photoUrl))
  const [removePhoto, setRemovePhoto] = useState(false)
  const labelClass = 'mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-100'
  const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 placeholder:text-slate-500 outline-none transition-colors focus:border-violet-600 focus:ring-4 focus:ring-violet-500/15 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-violet-400'

  const selectPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const validTypes = ['image/png', 'image/jpeg', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Format non autorisé. Utilisez une image PNG, JPG, JPEG ou WebP.')
      event.target.value = ''
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('La photo ne doit pas dépasser 2 Mo.')
      event.target.value = ''
      return
    }
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
    setRemovePhoto(false)
    setError('')
  }

  const clearPhoto = () => {
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    setPhoto(null)
    setPhotoPreview(null)
    setRemovePhoto(Boolean(renter?.photoUrl))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const data = {
      nom: formData.get('nom') as string,
      prenom: formData.get('prenom') as string,
      adresse: formData.get('adresse') as string,
      telephone: (formData.get('telephone') as string) || null,
      email: (formData.get('email') as string) || null,
      cin: (formData.get('cin') as string) || null,
      ville: (formData.get('ville') as string) || null,
    }

    const result = renter 
      ? await rentersAPI.update(renter.id, data)
      : await rentersAPI.create(data)

    if (result.success && result.data) {
      const renterId = result.data.id
      const photoResult = photo
        ? await rentersAPI.uploadPhoto(renterId, photo)
        : removePhoto && renter
          ? await rentersAPI.deletePhoto(renterId)
          : null
      if (photoResult && !photoResult.success) {
        setError(photoResult.error || 'Les informations ont été enregistrées, mais la photo n’a pas pu être sauvegardée.')
        setIsSubmitting(false)
        return
      }
      router.push('/locataires')
      router.refresh()
    } else {
      setError(result.error || 'Une erreur est survenue')
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.025]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-200 shadow-md ring-1 ring-slate-300 dark:border-slate-800 dark:bg-slate-800 dark:ring-slate-600">
            {photoPreview ? (
              <img src={photoPreview} alt="Aperçu de la photo du locataire" className="h-full w-full object-cover" />
            ) : (
              <UserRound size={42} className="text-slate-500 dark:text-slate-300" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2 text-slate-900 dark:text-white">
              <Camera size={18} className="text-violet-500" />
              <h2 className="font-semibold">Photo du locataire</h2>
            </div>
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">PNG, JPG, JPEG ou WebP · 2 Mo maximum</p>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-500 focus-within:ring-4 focus-within:ring-violet-500/20">
                <ImagePlus size={17} />
                {photoPreview ? 'Remplacer la photo' : 'Choisir une photo'}
                <input type="file" name="photo" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={selectPhoto} className="sr-only" />
              </label>
              {photoPreview && (
                <button type="button" onClick={clearPhoto} className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:bg-slate-900 dark:hover:bg-rose-500/10">
                  <Trash2 size={16} />Supprimer
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="prenom" className={labelClass}>
            Prénom *
          </label>
          <input
            type="text"
            id="prenom"
            name="prenom"
            defaultValue={renter?.prenom}
            required
            className={`h-11 ${fieldClass}`}
            placeholder="Jean"
          />
        </div>

        <div>
          <label htmlFor="nom" className={labelClass}>
            Nom *
          </label>
          <input
            type="text"
            id="nom"
            name="nom"
            defaultValue={renter?.nom}
            required
            className={`h-11 ${fieldClass}`}
            placeholder="Dupont"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {[
          ['telephone', 'Téléphone', renter?.telephone ?? '', '+216 20 000 000', 'tel'],
          ['email', 'E-mail', renter?.email ?? '', 'client@exemple.tn', 'email'],
          ['cin', 'Numéro de CIN', renter?.cin ?? '', '12345678', 'text'],
          ['ville', 'Ville', renter?.ville ?? '', 'Tunis', 'text'],
        ].map(([name, label, value, placeholder, type]) => (
          <div key={name}>
            <label htmlFor={name} className={labelClass}>{label}</label>
            <input
              id={name}
              name={name}
              type={type}
              defaultValue={value}
              placeholder={placeholder}
              className={`h-11 ${fieldClass}`}
            />
          </div>
        ))}
      </div>

      <div>
        <label htmlFor="adresse" className={labelClass}>
          Adresse *
        </label>
        <textarea
          id="adresse"
          name="adresse"
          defaultValue={renter?.adresse}
          required
          rows={3}
          className={`min-h-24 resize-y py-3 ${fieldClass}`}
          placeholder="123 Rue de la Paix, Paris, France"
        />
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Enregistrement...' : renter ? 'Modifier le Locataire' : 'Ajouter le Locataire'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
