import { RenterForm } from '@/components/RenterForm'

export default function NewRenterPage() {
  return (
    <div className="flex-1 bg-slate-50 dark:bg-[#07111f]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Ajouter un nouveau locataire</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Ajoutez un nouveau client à votre base de données</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md sm:p-8 dark:border-white/10 dark:bg-slate-900">
          <RenterForm />
        </div>
      </div>
    </div>
  )
}
