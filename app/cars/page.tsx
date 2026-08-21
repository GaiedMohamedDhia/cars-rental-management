"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { carsAPI, rentalsAPI } from "@/lib/api-client";
import { CarsCatalog } from "@/components/CarsCatalog";
import type { Car, Rental } from "@/types";

export default function CarsPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [carsResult, rentalsResult] = await Promise.all([
        carsAPI.getAll(),
        rentalsAPI.getAll(),
      ]);
      if (!active) return;
      setCars(carsResult.data || []);
      setRentals(rentalsResult.data || []);
      setError(
        carsResult.success
          ? rentalsResult.success
            ? ""
            : rentalsResult.error || "Impossible de charger les locations."
          : carsResult.error || "Impossible de charger les voitures.",
      );
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-full flex-1 bg-[var(--bg)]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-cyan-400">
              <ShieldCheck size={15} /> Parc automobile
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Gestion des voitures
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Consultez, filtrez et gérez tous les véhicules de votre flotte.
            </p>
          </div>
          <Link
            href="/cars/new"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            <Plus size={18} /> Ajouter une voiture
          </Link>
        </header>

        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-[390px] animate-pulse rounded-2xl bg-slate-900" />
            ))}
          </div>
        ) : (
          <CarsCatalog cars={cars} rentals={rentals} />
        )}
      </div>
    </main>
  );
}
