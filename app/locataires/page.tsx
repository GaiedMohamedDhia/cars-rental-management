"use client";

import { useEffect, useState } from "react";
import RentersDashboard from "@/components/RentersDashboard";
import { rentalsAPI, rentersAPI } from "@/lib/api-client";
import type { Rental, Renter } from "@/types";

export default function RentersPage() {
  const [renters, setRenters] = useState<Renter[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    let active = true;

    const load = async () => {
      const [rentersResult, rentalsResult] = await Promise.all([
        rentersAPI.getAll(),
        rentalsAPI.getAll(),
      ]);
      if (!active) return;

      setRenters(rentersResult.data || []);
      setRentals(rentalsResult.data || []);
      setLoadError(
        !rentersResult.success
          ? rentersResult.error || "Impossible de charger les locataires."
          : !rentalsResult.success
            ? rentalsResult.error || "Impossible de charger les locations."
            : undefined,
      );
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="h-16 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-900" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-900" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-900" />
      </main>
    );
  }

  return (
    <RentersDashboard
      initialRenters={renters}
      rentals={rentals}
      loadError={loadError}
    />
  );
}
