'use client'

import Link from 'next/link'
import { useSyncExternalStore, type ReactElement } from 'react'
import { Eye, Wrench } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts'
import type { Maintenance, Rental } from '@/types'

const CHART_HEIGHT = 230

interface RentalData {
  dateDebut: string
  montantTotal?: number | null
}

function coerceNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function isValidDate(d: Date): boolean {
  return !Number.isNaN(d.getTime())
}

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

/** Render charts only in the browser (Recharts + SSR/hydration) */
function ClientChart({ chart }: { chart: ReactElement }) {
  const ready = useIsClient()

  if (!ready) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-400"
        style={{ height: CHART_HEIGHT }}
      >
        Chargement du graphique…
      </div>
    )
  }

  return (
    <div className="w-full min-w-0" style={{ height: CHART_HEIGHT }}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        {chart}
      </ResponsiveContainer>
    </div>
  )
}

// Revenue Bar Chart - Monthly revenue
export function RevenueChart({ rentals }: { rentals: RentalData[] }) {
  const monthlyData = rentals.reduce(
    (acc, rental) => {
      const amount = coerceNumber(rental.montantTotal)
      if (amount <= 0) return acc
      const date = new Date(rental.dateDebut)
      if (!isValidDate(date)) return acc
      const monthKey = date.toLocaleString('fr-FR', { month: 'short', year: '2-digit' })

      if (!acc[monthKey]) {
        acc[monthKey] = { month: monthKey, revenue: 0 }
      }
      acc[monthKey].revenue += amount
      return acc
    },
    {} as Record<string, { month: string; revenue: number }>
  )

  const data =
    Object.values(monthlyData).slice(-6).length > 0
      ? Object.values(monthlyData).slice(-6)
      : [
          { month: 'Jan', revenue: 0 },
          { month: 'Fév', revenue: 0 },
        ]

  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0)

  return (
    <div className="rounded-2xl bg-white p-6 shadow-md">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">📊 Revenus Mensuels</h3>
          <p className="text-sm text-gray-500">Évolution des revenus par mois</p>
        </div>
        <div className="rounded-full bg-emerald-100 px-3 py-1">
          <span className="text-sm font-medium text-emerald-700">{totalRevenue.toFixed(0)} DT</span>
        </div>
      </div>
      <ClientChart
        chart={
          <BarChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickFormatter={(v) => `${v}`}
              width={70}
            />
            <Tooltip
              formatter={(value: number) => [`${Number(value).toFixed(2)} DT`, 'Revenus']}
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
            <Bar dataKey="revenue" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={48} />
          </BarChart>
        }
      />
    </div>
  )
}

// Car Status Pie Chart
export function CarStatusChart({ available, rented, maintenance = 0 }: { available: number; rented: number; maintenance?: number }) {
  const pieData = [
    { name: 'Disponibles', value: available, color: '#10B981' },
    { name: 'Louées', value: rented, color: '#F59E0B' },
    { name: 'Maintenance', value: maintenance, color: '#8B5CF6' },
  ].filter((d) => d.value > 0)

  const total = available + rented + maintenance

  return (
    <div className="rounded-2xl bg-white p-6 shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">🚗 État des Voitures</h3>
          <p className="text-sm text-gray-500">Répartition du parc automobile</p>
        </div>
        <div className="rounded-full bg-blue-100 px-3 py-1">
          <span className="text-sm font-medium text-blue-700">{total} voitures</span>
        </div>
      </div>
      {total === 0 ? (
        <div
          className="flex items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500"
          style={{ height: CHART_HEIGHT }}
        >
          Aucune voiture enregistrée
        </div>
      ) : (
        <ClientChart
          chart={
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={4}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) =>
                  `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number, name: string) => [`${value} voitures`, name]} />
            </PieChart>
          }
        />
      )}
      <div className="mt-4 flex justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-emerald-500" />
          <span className="text-sm text-gray-600">Disponibles ({available})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-amber-500" />
          <span className="text-sm text-gray-600">Louées ({rented})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-violet-500" />
          <span className="text-sm text-gray-600">Maintenance ({maintenance})</span>
        </div>
      </div>
    </div>
  )
}

export function TopCarsChart({ rentals }: { rentals: Rental[] }) {
  const counts = Array.from(
    rentals.reduce((acc, rental) => {
      const name = rental.car
        ? `${rental.car.marque} ${rental.car.modele}`
        : `Voiture #${rental.carId}`
      acc.set(name, (acc.get(name) || 0) + 1)
      return acc
    }, new Map<string, number>())
  )
    .map(([name, locations]) => ({ name, locations }))
    .sort((a, b) => b.locations - a.locations)
    .slice(0, 5)

  return (
    <ChartCard title="Top 5 des voitures" subtitle="Véhicules les plus loués">
      <ClientChart chart={
        <BarChart data={counts} layout="vertical" margin={{ top: 8, right: 15, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: '#64748b' }} />
          <Tooltip formatter={(value: number) => [`${value} location(s)`, 'Locations']} />
          <Bar dataKey="locations" fill="#6366F1" radius={[0, 6, 6, 0]} maxBarSize={24} />
        </BarChart>
      } />
    </ChartCard>
  )
}

export function RentalStatusChart({
  active,
  completed,
  overdue,
}: {
  active: number
  completed: number
  overdue: number
}) {
  const statusData = [
    { name: 'Actives', value: active, color: '#3B82F6' },
    { name: 'En retard', value: overdue, color: '#EF4444' },
    { name: 'Terminées', value: completed, color: '#10B981' },
  ]
  const pieData = statusData.filter((entry) => entry.value > 0)

  return (
    <ChartCard title="Statut des locations" subtitle="Répartition opérationnelle">
      <ClientChart chart={
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={76} dataKey="value" nameKey="name" paddingAngle={3}>
              {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
            </Pie>
            <Tooltip formatter={(value: number, name: string) => [`${value} location(s)`, name]} />
          </PieChart>
        } />
      <div className="mt-1 grid grid-cols-3 gap-2">
        {statusData.map((entry) => (
          <div key={entry.name} className="rounded-xl border border-slate-100 bg-slate-50/80 px-2 py-2 text-center">
            <span className="mx-auto mb-1 block h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <p className="text-[10px] font-semibold text-slate-500">{entry.name}</p>
            <p className="mt-0.5 text-sm font-black text-slate-800">{entry.value}</p>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}

export function MaintenanceHistoryCard({ maintenances }: { maintenances: Maintenance[] }) {
  const recent = [...maintenances]
    .sort((a, b) => {
      const aDate = new Date(a.date_maintenance || a.created_at)
      const bDate = new Date(b.date_maintenance || b.created_at)
      const aTime = isValidDate(aDate) ? aDate.getTime() : 0
      const bTime = isValidDate(bDate) ? bDate.getTime() : 0
      return bTime - aTime
    })
    .slice(0, 5)

  const statusStyle = (status?: string | null) => {
    const normalized = (status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    if (normalized === 'terminee') return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
    if (normalized === 'en cours') return 'bg-sky-50 text-sky-700 ring-sky-100'
    if (normalized === 'annulee') return 'bg-rose-50 text-rose-700 ring-rose-100'
    return 'bg-amber-50 text-amber-700 ring-amber-100'
  }

  const formatMaintenanceDate = (value?: string | null) => {
    if (!value) return 'Date non renseignée'
    const parsed = new Date(value)
    return isValidDate(parsed)
      ? new Intl.DateTimeFormat('fr-FR').format(parsed)
      : 'Date non renseignée'
  }

  const formatMaintenanceCost = (value?: number | null) =>
    value === null || value === undefined || !Number.isFinite(Number(value))
      ? 'Coût non renseigné'
      : `${new Intl.NumberFormat('fr-TN', { maximumFractionDigits: 2 }).format(Number(value))} TND`

  return (
    <article className="flex h-full min-h-[374px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-900">Historique des maintenances</h3>
          <p className="mt-0.5 text-xs text-slate-400">Dernières interventions enregistrées</p>
        </div>
        <Link href="/maintenance" className="shrink-0 text-xs font-bold text-violet-600 transition hover:text-violet-500">
          Tout voir
        </Link>
      </header>

      {recent.length === 0 ? (
        <div className="mt-4 flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 text-center">
          <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-violet-50 text-violet-500">
            <Wrench size={20} />
          </span>
          <p className="text-sm font-semibold text-slate-800">Aucune maintenance enregistrée</p>
          <p className="mt-1 text-xs text-slate-400">Les dernières interventions apparaîtront ici.</p>
        </div>
      ) : (
        <div className="mt-3 min-h-0 flex-1 divide-y divide-slate-100">
          {recent.map((item) => {
            const vehicle = item.car
              ? `${item.car.marque} ${item.car.modele}`
              : `Véhicule #${item.car_id}`
            return (
              <div key={item.id} className="group flex items-center gap-3 py-2.5 first:pt-1.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-500">
                  <Wrench size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-xs font-black text-slate-800">{vehicle}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ring-1 ${statusStyle(item.statut)}`}>
                      {item.statut || 'Non renseigné'}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] font-medium text-slate-400">
                    {item.car?.numImma || 'Immatriculation non renseignée'}
                  </p>
                  <p className="mt-1 truncate text-[10px] text-slate-500">
                    {item.type_maintenance || 'Type non renseigné'} · {formatMaintenanceDate(item.date_maintenance || item.created_at)} · {formatMaintenanceCost(item.cout)} · {item.kilometrage !== null && item.kilometrage !== undefined ? `${new Intl.NumberFormat('fr-FR').format(item.kilometrage)} km` : 'Kilométrage non renseigné'}
                  </p>
                </div>
                <Link
                  href={`/maintenance?view=${item.id}`}
                  title="Voir la maintenance"
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[10px] font-bold text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600"
                >
                  <Eye size={13} />Voir
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </article>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-black text-slate-900">{title}</h3>
      <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
      <div className="mt-3">{children}</div>
    </div>
  )
}

// Rentals Trend — weekly rental count (line chart, single axis)
export function RentalsTrendChart({ rentals }: { rentals: RentalData[] }) {
  const weeklyData = rentals.reduce(
    (acc, rental) => {
      const date = new Date(rental.dateDebut)
      if (!isValidDate(date)) return acc
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      if (!isValidDate(weekStart)) return acc
      const weekKey = weekStart.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })

      if (!acc[weekKey]) {
        acc[weekKey] = { week: weekKey, locations: 0, revenue: 0 }
      }
      acc[weekKey].locations += 1
      acc[weekKey].revenue += coerceNumber(rental.montantTotal)
      return acc
    },
    {} as Record<string, { week: string; locations: number; revenue: number }>
  )

  const data =
    Object.values(weeklyData).slice(-8).length > 0
      ? Object.values(weeklyData).slice(-8)
      : [
          { week: 'Sem. 1', locations: 0, revenue: 0 },
          { week: 'Sem. 2', locations: 0, revenue: 0 },
        ]

  return (
    <div className="rounded-2xl bg-white p-6 shadow-md">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">📈 Tendance des Locations</h3>
          <p className="text-sm text-gray-500">Nombre de locations par semaine</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-blue-500" />
          <span className="text-sm text-gray-600">Locations / semaine</span>
        </div>
      </div>
      <ClientChart
        chart={
          <LineChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} width={40} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
              formatter={(value: number, name: string) => {
                if (name === 'locations') return [`${value} location(s)`, 'Locations']
                return [`${Number(value).toFixed(2)} DT`, 'Revenus']
              }}
              labelFormatter={(label) => `Semaine ${label}`}
            />
            <Line
              type="linear"
              dataKey="locations"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ r: 4, fill: '#3B82F6' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        }
      />
    </div>
  )
}
