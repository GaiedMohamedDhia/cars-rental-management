'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, CarFront, Eye, Fuel, Gauge, Pencil, Search, Settings2, SlidersHorizontal, Tag, Users, WalletCards, X } from 'lucide-react'
import type { Car, Rental } from '@/types'
import { DeleteCarButton } from './DeleteCarButton'
import { isReturned, plannedReturnDate } from '@/lib/rental-status'

type SortValue = 'newest' | 'price-asc' | 'price-desc' | 'km-asc' | 'year-desc'

export function CarsCatalog({ cars, rentals = [] }: { cars: Car[]; rentals?: Rental[] }) {
  const [carItems, setCarItems] = useState(cars)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('all')
  const [fuel, setFuel] = useState('all')
  const [transmission, setTransmission] = useState('all')
  const [sort, setSort] = useState<SortValue>('newest')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filtersRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(event.target as Node)) setFiltersOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFiltersOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const values = (key: 'categorie' | 'carburant' | 'transmission') =>
    [...new Set(carItems.map((car) => car[key]).filter((value): value is string => Boolean(value)))].sort()

  const filteredCars = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr')
    return carItems
      .filter((car) => !query || `${car.marque} ${car.modele} ${car.numImma}`.toLocaleLowerCase('fr').includes(query))
      .filter((car) => status === 'all' || String(car.etat) === status)
      .filter((car) => category === 'all' || car.categorie === category)
      .filter((car) => fuel === 'all' || car.carburant === fuel)
      .filter((car) => transmission === 'all' || car.transmission === transmission)
      .sort((a, b) => {
        if (sort === 'price-asc') return (a.prixLocation || 0) - (b.prixLocation || 0)
        if (sort === 'price-desc') return (b.prixLocation || 0) - (a.prixLocation || 0)
        if (sort === 'km-asc') return (a.kilometrage || 0) - (b.kilometrage || 0)
        if (sort === 'year-desc') return (b.annee || 0) - (a.annee || 0)
        return b.id - a.id
      })
  }, [carItems, search, status, category, fuel, transmission, sort])

  const reset = () => {
    setStatus('all'); setCategory('all'); setFuel('all'); setTransmission('all'); setSort('newest')
  }
  const hasFilters = Boolean(status !== 'all' || category !== 'all' || fuel !== 'all' || transmission !== 'all' || sort !== 'newest')
  const activeFilterCount = [status, category, fuel, transmission].filter((value) => value !== 'all').length + (sort !== 'newest' ? 1 : 0)

  return (
    <>
      <div className="relative z-20 mb-4 flex gap-2" ref={filtersRef}>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une voiture..." className="h-11 w-full rounded-xl border border-slate-800 bg-slate-900/70 pl-10 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 hover:border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10" />
        </div>
        <button type="button" aria-expanded={filtersOpen} aria-haspopup="dialog" onClick={() => setFiltersOpen((open) => !open)} className={`relative inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition sm:px-4 ${filtersOpen || hasFilters ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300' : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800'}`}>
          <SlidersHorizontal size={16} /><span>Filtres</span>
          {activeFilterCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-500 px-1 text-[10px] font-black text-slate-950">{activeFilterCount}</span>}
        </button>

        {filtersOpen && (
          <div role="dialog" aria-label="Filtres avancés" className="absolute right-0 top-[calc(100%+8px)] w-full origin-top-right animate-[fadeIn_.16s_ease-out] rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl shadow-black/40 sm:w-[420px]">
            <div className="mb-3 flex items-center justify-between">
              <div><h2 className="text-sm font-bold text-white">Filtres avancés</h2><p className="mt-0.5 text-xs text-slate-500">Affinez les véhicules affichés.</p></div>
              <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Fermer" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-white"><X size={16} /></button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="filter-control"><option value="all">Tous les statuts</option><option value="0">Disponible</option><option value="1">Louée</option></select>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="filter-control"><option value="all">Toutes catégories</option>{values('categorie').map((value) => <option key={value}>{value}</option>)}</select>
              <select value={fuel} onChange={(e) => setFuel(e.target.value)} className="filter-control"><option value="all">Tous carburants</option>{values('carburant').map((value) => <option key={value}>{value}</option>)}</select>
              <select value={transmission} onChange={(e) => setTransmission(e.target.value)} className="filter-control"><option value="all">Toutes transmissions</option>{values('transmission').map((value) => <option key={value}>{value}</option>)}</select>
              <select value={sort} onChange={(e) => setSort(e.target.value as SortValue)} className="filter-control sm:col-span-2"><option value="newest">Plus récentes</option><option value="price-asc">Prix croissant</option><option value="price-desc">Prix décroissant</option><option value="km-asc">Kilométrage</option><option value="year-desc">Année</option></select>
            </div>
            <div className="mt-4 flex justify-end border-t border-slate-800 pt-3">
              <button type="button" onClick={reset} disabled={!hasFilters} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-bold text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"><X size={14} /> Réinitialiser</button>
            </div>
          </div>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between text-sm text-slate-400">
        <span>{filteredCars.length} véhicule{filteredCars.length > 1 ? 's' : ''}</span>
        {hasFilters && <span className="text-xs font-medium text-cyan-400">{activeFilterCount} filtre{activeFilterCount > 1 ? 's' : ''} actif{activeFilterCount > 1 ? 's' : ''}</span>}
      </div>

      {filteredCars.length ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredCars.map((car) => (
            <CarCard
              key={car.id}
              car={car}
              rental={rentals.find((item) => item.carId === car.id && !isReturned(item))}
              onDeleted={() =>
                setCarItems((items) => items.filter((item) => item.id !== car.id))
              }
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-16 text-center">
          <CarFront className="mx-auto text-slate-600" size={42} />
          <h2 className="mt-4 font-bold text-white">Aucun véhicule trouvé</h2>
          <p className="mt-1 text-sm text-slate-400">Modifiez ou réinitialisez les filtres.</p>
        </div>
      )}
    </>
  )
}

function CarCard({
  car,
  rental,
  onDeleted,
}: {
  car: Car
  rental?: Rental
  onDeleted: () => void
}) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const available = car.etat === 0
  const statuses = {
    0: { label: 'Disponible', badge: 'border-emerald-400/30 bg-emerald-500/90', border: 'border-t-emerald-500' },
    1: { label: 'Louée', badge: 'border-red-400/30 bg-red-500/90', border: 'border-t-red-500' },
    2: { label: 'En maintenance', badge: 'border-amber-400/30 bg-amber-500/90', border: 'border-t-amber-500' },
    3: { label: 'Indisponible', badge: 'border-slate-400/30 bg-slate-500/90', border: 'border-t-slate-500' },
  } as const
  const status = statuses[(car.etat in statuses ? car.etat : 3) as keyof typeof statuses]
  const features = [
    { icon: Gauge, label: `${Number(car.kilometrage || 0).toLocaleString('fr-FR')} km` },
    { icon: WalletCards, label: `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(car.prixLocation || 0))} DT / jour` },
    car.carburant ? { icon: Fuel, label: car.carburant } : null,
    car.transmission ? { icon: Settings2, label: car.transmission } : null,
    car.nombrePlaces ? { icon: Users, label: `${car.nombrePlaces} places` } : null,
    car.categorie ? { icon: Tag, label: car.categorie } : null,
  ].filter(Boolean) as { icon: typeof Gauge; label: string }[]
  const brand = displayVehicleName(car.marque)
  const model = displayVehicleName(car.modele)
  const returnDate = rental ? plannedReturnDate(rental) : null

  const movePhoto = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const box = event.currentTarget.getBoundingClientRect()
    setTilt({
      x: -((event.clientY - box.top) / box.height - 0.5) * 6,
      y: ((event.clientX - box.left) / box.width - 0.5) * 8,
    })
  }

  return (
    <article className={`group flex min-h-[430px] flex-col overflow-hidden rounded-2xl border border-slate-800 border-t-2 bg-slate-900/90 shadow-lg shadow-slate-950/20 transition duration-300 hover:-translate-y-1 hover:border-slate-700 hover:shadow-2xl ${status.border}`}>
      <div className="relative flex h-[150px] items-center justify-center bg-slate-950/70 px-3 py-2 [perspective:900px]">
        <div
          onPointerMove={movePhoto}
          onPointerLeave={() => setTilt({ x: 0, y: 0 })}
          className="vehicle-tilt relative h-[134px] w-[220px] max-w-full overflow-hidden rounded-xl border border-slate-700/70 bg-[radial-gradient(circle_at_center,#1e293b,#0f172a)] transition-[transform,box-shadow] duration-200 ease-out"
          style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${tilt.x || tilt.y ? 1.025 : 1})`, boxShadow: `${-tilt.y}px ${8 + tilt.x}px 24px rgba(0,0,0,.34)` }}
        >
          {car.photoUrl && !imageFailed && !imageLoaded && <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900" />}
          {!car.photoUrl || imageFailed ? (
            <div className="flex h-full flex-col items-center justify-center gap-1.5 text-slate-500"><CarFront size={34} strokeWidth={1.4} /><span className="text-[10px] font-semibold">Photo non disponible</span></div>
          ) : (
            <Image src={car.photoUrl} alt={`${brand} ${model}${car.annee ? ` ${car.annee}` : ''}`} fill unoptimized sizes="220px" onLoad={() => setImageLoaded(true)} onError={() => { setImageFailed(true); setImageLoaded(true) }} className={`object-contain object-center p-0.5 transition duration-300 group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none ${imageLoaded ? 'opacity-100' : 'opacity-0'}`} />
          )}
        </div>
        <span className={`absolute right-2.5 top-2.5 rounded-full border px-2 py-0.5 text-[10px] font-bold text-white shadow backdrop-blur ${status.badge}`}>{status.label}</span>
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><h2 className="truncate text-lg font-black text-white">{brand} <span className="text-slate-200">{model}</span></h2><p className="mt-0.5 text-xs font-medium text-slate-400">{car.numImma}</p></div>
          {car.annee && <span className="rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{car.annee}</span>}
        </div>
        <div className="mt-2.5 grid min-h-[70px] grid-cols-2 content-start gap-x-3 gap-y-1.5">
          {features.map(({ icon: Icon, label }) => <div key={label} className="flex min-w-0 items-center gap-2 text-xs text-slate-300"><Icon className="shrink-0 text-slate-500" size={14} /><span className="truncate">{label}</span></div>)}
        </div>
        <div className="mt-2.5 min-h-[34px] border-t border-slate-800 pt-2.5 text-[11px] text-slate-400">{available ? <span className="font-semibold text-emerald-400">Disponible à la location</span> : rental ? <span><b className="text-slate-300">{rental.renter?.prenom} {rental.renter?.nom}</b>{returnDate ? ` · retour ${new Intl.DateTimeFormat('fr-FR').format(returnDate)}` : ''}</span> : <span>{status.label}</span>}{car.couleur && !rental && <span className="float-right">Couleur : {car.couleur}</span>}</div>
        <div className="mt-auto flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-800 pt-3">
          {available && <Link href={`/rentals/new?carId=${car.id}`} className="mr-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 text-[11px] font-bold text-emerald-400 transition hover:bg-emerald-500/20"><CarFront size={13} /> Louer</Link>}
          {!available && rental && <Link href={`/rentals/${rental.id}`} className="mr-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-500/10 px-2.5 text-[11px] font-bold text-blue-400 transition hover:bg-blue-500/20"><Eye size={13} /> Voir la location</Link>}
          <Link href={`/cars/${car.id}`} aria-label={`Voir ${car.marque} ${car.modele}`} className="action-button !h-8 !px-2"><Eye size={13} /><span className="hidden sm:inline">Voir</span></Link>
          <Link href={`/cars/${car.id}/edit`} aria-label={`Modifier ${car.marque} ${car.modele}`} className="action-button !h-8 !px-2"><Pencil size={13} /><span className="hidden sm:inline">Modifier</span></Link>
          <DeleteCarButton carId={car.id} carName={`${car.marque} ${car.modele}`} compact onDeleted={onDeleted} />
        </div>
      </div>
    </article>
  )
}

function displayVehicleName(value: string) {
  const corrected = value.trim().toLowerCase().replace(/\btoyata\b/g, 'toyota').replace(/\bcorrola\b/g, 'corolla')
  return corrected.replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toUpperCase())
}
