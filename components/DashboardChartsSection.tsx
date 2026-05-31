'use client'

import dynamic from 'next/dynamic'

const chartLoading = (
  <div
    className="animate-pulse rounded-2xl bg-gray-100"
    style={{ height: 280 }}
  />
)

const RevenueChart = dynamic(
  () => import('@/components/DashboardCharts').then((m) => m.RevenueChart),
  { ssr: false, loading: () => chartLoading }
)

const CarStatusChart = dynamic(
  () => import('@/components/DashboardCharts').then((m) => m.CarStatusChart),
  { ssr: false, loading: () => chartLoading }
)

const RentalsTrendChart = dynamic(
  () => import('@/components/DashboardCharts').then((m) => m.RentalsTrendChart),
  { ssr: false, loading: () => chartLoading }
)

interface ChartRental {
  dateDebut: string
  montantTotal?: number | null
}

interface DashboardChartsSectionProps {
  chartRentals: ChartRental[]
  availableCars: number
  rentedCars: number
}

export function DashboardChartsSection({
  chartRentals,
  availableCars,
  rentedCars,
}: DashboardChartsSectionProps) {
  return (
    <>
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RevenueChart rentals={chartRentals} />
        <CarStatusChart available={availableCars} rented={rentedCars} />
      </div>
      <div className="mb-8">
        <RentalsTrendChart rentals={chartRentals} />
      </div>
    </>
  )
}
