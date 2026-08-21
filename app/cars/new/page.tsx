import { VehicleForm } from '@/components/CarForm'

export default function NewCarPage() {
  return (
    <div className="flex-1 bg-[var(--bg)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Ajouter une voiture</h1>
          <p className="mt-1 text-sm text-slate-400">Ajoutez un nouveau véhicule à votre parc</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/85 p-5 shadow-xl sm:p-7">
          <VehicleForm />
        </div>
      </div>
    </div>
  )
}
