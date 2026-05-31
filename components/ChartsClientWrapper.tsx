'use client'

import React from 'react'
import { RevenueChart, CarStatusChart, RentalsTrendChart } from './DashboardCharts'

interface RentalData {
  dateDebut: string
  montantTotal?: number | null
}

export function ChartsClientWrapper({
  chartRentals,
  availableCars,
  rentedCars
}: {
  chartRentals: RentalData[]
  availableCars: number
  rentedCars: number
}) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <RevenueChart rentals={chartRentals} />
        <CarStatusChart available={availableCars} rented={rentedCars} />
      </div>

      {/* Rentals Trend Chart - Full Width */}
      <div className="mb-8 w-full min-w-0">
        <RentalsTrendChart rentals={chartRentals} />
      </div>
    </>
  )
}
