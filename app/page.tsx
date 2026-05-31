import Link from 'next/link'
import { carsAPI, rentersAPI, rentalsAPI } from '@/lib/api-client'
import { DashboardChartsSection } from '@/components/DashboardChartsSection'

export default async function HomePage() {
  // Fetch data from API
  const [carsResult, rentersResult, rentalsResult] = await Promise.all([
    carsAPI.getAll(),
    rentersAPI.getAll(),
    rentalsAPI.getAll()
  ])

  const cars = carsResult.data || []
  const renters = rentersResult.data || []
  const rentals = rentalsResult.data || []

  // Calculate statistics
  const totalCars = cars.length
  const availableCars = cars.filter(c => c.etat === 0).length
  const rentedCars = cars.filter(c => c.etat === 1).length
  
  const now = new Date()
  
  // Active = Car not returned yet (kmFin is null) AND (no end date OR end date in future)
  const activeRentals = rentals.filter(r => {
    if (r.kmFin !== null) return false
    if (!r.dateFin) return true
    const endDate = new Date(r.dateFin)
    return endDate >= now
  }).length

  // Count renters with active rentals
  const rentersWithActiveRentals = new Set(
    rentals.filter(r => {
      if (r.kmFin !== null) return false
      if (!r.dateFin) return true
      const endDate = new Date(r.dateFin)
      return endDate >= now
    }).map(r => r.renterId)
  ).size

  // REVENUE: Counted when rental is CREATED (payment is upfront)
  // Based on dateDebut (rental start date = payment date)
  const rentalsWithRevenue = rentals.filter(r => r.montantTotal && r.montantTotal > 0)
  const totalRevenue = rentalsWithRevenue.reduce((sum, r) => sum + (r.montantTotal || 0), 0)
  
  // Revenue by period - based on when rental STARTED (dateDebut)
  const todayRevenue = rentalsWithRevenue
    .filter(r => {
      const startDate = new Date(r.dateDebut)
      return startDate.toDateString() === now.toDateString()
    })
    .reduce((sum, r) => sum + (r.montantTotal || 0), 0)
  
  const thisWeekRevenue = rentalsWithRevenue
    .filter(r => {
      const startDate = new Date(r.dateDebut)
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return startDate >= weekAgo
    })
    .reduce((sum, r) => sum + (r.montantTotal || 0), 0)
  
  const thisMonthRevenue = rentalsWithRevenue
    .filter(r => {
      const startDate = new Date(r.dateDebut)
      return startDate.getMonth() === now.getMonth() && startDate.getFullYear() === now.getFullYear()
    })
    .reduce((sum, r) => sum + (r.montantTotal || 0), 0)

  const stats = [
    {
      title: 'Total Voitures',
      value: totalCars,
      description: `${availableCars} disponibles, ${rentedCars} louées`,
      href: '/cars',
      color: 'from-blue-500 to-blue-600',
      icon: '🚗'
    },
    {
      title: 'Total Locataires',
      value: renters.length,
      description: `${rentersWithActiveRentals} en location`,
      href: '/renters',
      color: 'from-purple-500 to-purple-600',
      icon: '👥'
    },
    {
      title: 'Locations Actives',
      value: activeRentals,
      description: 'En cours',
      href: '/rentals',
      color: 'from-orange-500 to-orange-600',
      icon: '📋'
    },
    {
      title: 'Revenus Total',
      value: `${totalRevenue.toFixed(2)} DT`,
      description: `${rentalsWithRevenue.length} locations payées`,
      href: '/rentals',
      color: 'from-emerald-500 to-emerald-600',
      icon: '💰'
    }
  ]

  const revenueStats = [
    { period: "Aujourd'hui", amount: todayRevenue, icon: '📅', color: 'from-blue-50 to-blue-100', borderColor: 'border-blue-200', textColor: 'text-blue-700' },
    { period: 'Cette Semaine', amount: thisWeekRevenue, icon: '📊', color: 'from-purple-50 to-purple-100', borderColor: 'border-purple-200', textColor: 'text-purple-700' },
    { period: 'Ce Mois', amount: thisMonthRevenue, icon: '📈', color: 'from-emerald-50 to-emerald-100', borderColor: 'border-emerald-200', textColor: 'text-emerald-700' }
  ]

  // Prepare data for charts
  const chartRentals = rentals.map(r => ({
    dateDebut: r.dateDebut,
    montantTotal: r.montantTotal
  }))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Tableau de Bord
              </h1>
              <p className="mt-1 text-sm text-gray-500">Gérez votre entreprise de location de voitures</p>
            </div>
            <div className="hidden md:flex items-center gap-2 bg-gradient-to-r from-green-100 to-emerald-100 px-4 py-2 rounded-full">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-sm font-medium text-green-700">Système Actif</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <Link
              key={stat.title}
              href={stat.href}
              className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <span className="text-2xl">{stat.icon}</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className="mt-2 text-xs text-gray-500">{stat.description}</p>
              </div>
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
            </Link>
          ))}
        </div>

        {/* Revenue Stats Section */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-8 border border-gray-100" id="revenue-section">
          <h2 className="text-xl font-bold text-gray-900 mb-4">💰 Revenus par Période</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {revenueStats.map((stat) => (
              <div key={stat.period} className={`bg-gradient-to-br ${stat.color} rounded-xl p-5 border-2 ${stat.borderColor} hover:shadow-md transition-shadow`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{stat.icon}</span>
                  <span className={`text-sm font-medium ${stat.textColor}`}>{stat.period}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stat.amount.toFixed(2)} DT</p>
                <p className="text-xs text-gray-600 mt-1">Bénéfices générés</p>
              </div>
            ))}
          </div>
        </div>

        <DashboardChartsSection
          chartRentals={chartRentals}
          availableCars={availableCars}
          rentedCars={rentedCars}
        />

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4">⚡ Actions Rapides</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/cars"
              className="flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Gérer les Voitures
            </Link>
            
            <Link
              href="/renters"
              className="flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Gérer les Locataires
            </Link>
            
            <Link
              href="/rentals/new"
              className="flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Nouvelle Location
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
