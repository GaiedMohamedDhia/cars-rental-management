"use client";

import dynamic from "next/dynamic";
import type { Maintenance, Rental } from "@/types";

const chartLoading = <div className="h-[260px] animate-pulse rounded-2xl bg-slate-100" />;
const RevenueChart = dynamic(
  () => import("@/components/DashboardCharts").then((module) => module.RevenueChart),
  { ssr: false, loading: () => chartLoading },
);
const CarStatusChart = dynamic(
  () => import("@/components/DashboardCharts").then((module) => module.CarStatusChart),
  { ssr: false, loading: () => chartLoading },
);
const RentalsTrendChart = dynamic(
  () => import("@/components/DashboardCharts").then((module) => module.RentalsTrendChart),
  { ssr: false, loading: () => chartLoading },
);
const TopCarsChart = dynamic(
  () => import("@/components/DashboardCharts").then((module) => module.TopCarsChart),
  { ssr: false, loading: () => chartLoading },
);
const RentalStatusChart = dynamic(
  () => import("@/components/DashboardCharts").then((module) => module.RentalStatusChart),
  { ssr: false, loading: () => chartLoading },
);
const MaintenanceHistoryCard = dynamic(
  () => import("@/components/DashboardCharts").then((module) => module.MaintenanceHistoryCard),
  {
    ssr: false,
    loading: () => (
      <div className="h-[374px] rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-3 w-32 animate-pulse rounded bg-slate-100" />
        <div className="mt-5 space-y-3">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="flex items-center gap-3">
              <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                <div className="h-2.5 w-full animate-pulse rounded bg-slate-50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
);

export function DashboardChartsSection({
  rentals,
  maintenances,
  availableCars,
  rentedCars,
  maintenanceCars,
  activeRentals,
  completedRentals,
  overdueRentals,
}: {
  rentals: Rental[];
  maintenances: Maintenance[];
  availableCars: number;
  rentedCars: number;
  maintenanceCars: number;
  activeRentals: number;
  completedRentals: number;
  overdueRentals: number;
}) {
  return (
    <section className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <RevenueChart rentals={rentals} />
      <RentalsTrendChart rentals={rentals} />
      <TopCarsChart rentals={rentals} />
      <CarStatusChart available={availableCars} rented={rentedCars} maintenance={maintenanceCars} />
      <RentalStatusChart
        active={activeRentals}
        completed={completedRentals}
        overdue={overdueRentals}
      />
      <MaintenanceHistoryCard maintenances={maintenances} />
    </section>
  );
}
