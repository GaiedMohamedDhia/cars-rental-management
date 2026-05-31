'use client'

import { useSyncExternalStore, type ReactElement } from 'react'
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

const CHART_HEIGHT = 280

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
export function CarStatusChart({ available, rented }: { available: number; rented: number }) {
  const pieData = [
    { name: 'Disponibles', value: available, color: '#10B981' },
    { name: 'Louées', value: rented, color: '#F59E0B' },
  ].filter((d) => d.value > 0)

  const total = available + rented

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
      </div>
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
