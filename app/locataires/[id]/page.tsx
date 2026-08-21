"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck2,
  CarFront,
  CheckCircle2,
  Clock3,
  IdCard,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ReceiptText,
  UserRound,
} from "lucide-react";

import { rentersAPI, rentalsAPI } from "@/lib/api-client";
import type { Rental, Renter } from "@/types";
import { actualReturnDate, isReturned, plannedReturnDate } from "@/lib/rental-status";
import { resolveMediaUrl } from "@/lib/media-url";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}

function formatAmount(value: number | null | undefined) {
  if (value === null || value === undefined) return "Non renseigné";

  return new Intl.NumberFormat("fr-TN", {
    style: "currency",
    currency: "TND",
    maximumFractionDigits: 2,
  }).format(value);
}

function RentalCard({ rental, active }: { rental: Rental; active: boolean }) {
  const carName = rental.car
    ? `${rental.car.marque} ${rental.car.modele}`
    : `Voiture #${rental.carId}`;

  return (
    <Link
      href={`/rentals/${rental.id}`}
      className="group grid gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-violet-400/40 sm:grid-cols-[1fr_auto] sm:items-center"
    >
      <div className="flex min-w-0 items-start gap-4">
        <div
          className={`rounded-xl p-3 ${
            active
              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300"
          }`}
        >
          <CarFront size={22} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-bold text-slate-900 dark:text-white">{carName}</h3>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                active
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
              }`}
            >
              {active ? "Active" : "Terminée"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
            <span>Du {formatDate(rental.dateDebut)}</span>
            <span>
              {active
                ? plannedReturnDate(rental)
                  ? `Retour prévu le ${formatDate(plannedReturnDate(rental)?.toISOString())}`
                  : "Retour à confirmer"
                : `Terminée le ${formatDate(actualReturnDate(rental)?.toISOString())}`}
            </span>
            {rental.car?.numImma ? <span>{rental.car.numImma}</span> : null}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:block sm:text-right">
        <p className="font-bold text-slate-900 dark:text-white">
          {formatAmount(rental.montantTotal)}
        </p>
        <span className="mt-1 inline-block text-sm font-semibold text-violet-600 transition group-hover:translate-x-1 dark:text-violet-300">
          Voir les détails →
        </span>
      </div>
    </Link>
  );
}

export default function RenterDetailPage() {
  const params = useParams<{ id: string }>();
  const renterId = Number.parseInt(params.id, 10);
  const [renter, setRenter] = useState<Renter | null>(null);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [rentalsError, setRentalsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!Number.isInteger(renterId) || renterId <= 0) {
      setError("Identifiant de locataire invalide.");
      setLoading(false);
      return;
    }
    Promise.all([rentersAPI.getById(renterId), rentalsAPI.getAll()]).then(
      ([renterResult, rentalsResult]) => {
        setRenter(renterResult.data || null);
        setError(renterResult.success ? "" : renterResult.error || "Locataire introuvable.");
        setRentals(
          rentalsResult.success
            ? (rentalsResult.data ?? []).filter((rental) => rental.renterId === renterId)
            : [],
        );
        setRentalsError(!rentalsResult.success);
        setLoading(false);
      },
    );
  }, [renterId]);

  if (loading) {
    return <main className="min-h-full bg-slate-50 p-8 dark:bg-[#07111f]"><div className="mx-auto h-[560px] max-w-6xl animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-900" /></main>;
  }
  if (!renter) {
    return <main className="min-h-full bg-slate-50 p-8 dark:bg-[#07111f]"><div className="mx-auto max-w-xl rounded-xl border border-red-300 bg-red-50 p-4 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error}</div></main>;
  }
  const activeRentals = rentals.filter((rental) => !isReturned(rental));
  const completedRentals = rentals.filter(isReturned);
  const sortedRentals = [...rentals].sort(
    (a, b) => new Date(b.dateDebut).getTime() - new Date(a.dateDebut).getTime(),
  );

  const stats = [
    {
      label: "Total locations",
      value: rentals.length,
      detail: "Toutes les locations",
      icon: ReceiptText,
      tone: "from-violet-500 to-fuchsia-500",
    },
    {
      label: "Locations actives",
      value: activeRentals.length,
      detail: activeRentals.length ? "En cours actuellement" : "Aucune en cours",
      icon: Clock3,
      tone: "from-emerald-500 to-teal-500",
    },
    {
      label: "Terminées",
      value: completedRentals.length,
      detail: "Locations clôturées",
      icon: CheckCircle2,
      tone: "from-sky-500 to-blue-600",
    },
  ];

  return (
    <main className="min-h-full bg-slate-50 px-4 py-6 text-slate-900 dark:bg-[#07111f] dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/locataires"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-violet-600 transition hover:-translate-x-1 hover:text-violet-700 dark:text-violet-300"
        >
          <ArrowLeft size={17} />
          Retour aux locataires
        </Link>

        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 dark:border-white/10 dark:bg-[#0c1729] dark:shadow-black/20">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-sky-500" />
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

          <div className="relative p-5 sm:p-7">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-violet-500/20 ring-1 ring-slate-200 dark:border-slate-900 dark:ring-white/15">
                  {resolveMediaUrl(renter.photoUrl) ? (
                    <img
                      src={resolveMediaUrl(renter.photoUrl)!}
                      alt={`Photo de ${renter.prenom} ${renter.nom}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserRound size={44} />
                  )}
                </div>
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">
                    Profil locataire
                  </p>
                  <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                    {renter.prenom} {renter.nom}
                  </h1>
                  <p className="mt-2 flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <MapPin size={17} className="text-rose-500" />
                    {renter.adresse}
                  </p>
                </div>
              </div>
              <span className="w-fit rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-bold text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-200">
                ID · #{renter.id}
              </span>
            </div>

            <div className="mt-7 grid gap-3 md:grid-cols-3">
              {stats.map(({ label, value, detail, icon: Icon, tone }) => (
                <div
                  key={label}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 transition duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.035]"
                >
                  <div className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${tone}`} />
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
                      <p className="mt-1 text-3xl font-black">{value}</p>
                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{detail}</p>
                    </div>
                    <div className={`rounded-xl bg-gradient-to-br ${tone} p-3 text-white shadow-md`}>
                      <Icon size={21} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-white/10 dark:bg-white/[0.025]">
              {[
                { label: "Téléphone", value: renter.telephone, icon: Phone },
                { label: "E-mail", value: renter.email, icon: Mail },
                { label: "CIN", value: renter.cin, icon: IdCard },
                { label: "Ville", value: renter.ville, icon: MapPin },
                { label: "Adresse", value: renter.adresse, icon: MapPin },
                { label: "Date d'inscription", value: formatDate(renter.createdAt), icon: CalendarCheck2 },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex min-w-0 items-start gap-3 rounded-xl bg-white p-3 dark:bg-white/[0.035]">
                  <Icon size={17} className="mt-0.5 shrink-0 text-violet-500" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500">{label}</p>
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {value || "Non renseigné"}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {rentalsError ? (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
                Les informations du locataire sont disponibles, mais ses locations n’ont pas pu
                être chargées. Réessayez dans quelques instants.
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 dark:border-white/10 sm:flex-row">
              <Link
                href={`/locataires/${renter.id}/edit`}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-6 py-3.5 font-bold text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 hover:brightness-110"
              >
                <Pencil size={18} />
                Modifier le locataire
              </Link>
              <Link
                href="/rentals/new"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 font-bold text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
              >
                <CalendarCheck2 size={18} />
                Nouvelle location
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">
                Activité
              </p>
              <h2 className="mt-1 text-2xl font-black">Locations du locataire</h2>
            </div>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {rentals.length} résultat{rentals.length === 1 ? "" : "s"}
            </span>
          </div>

          {sortedRentals.length ? (
            <div className="space-y-3">
              {sortedRentals.map((rental) => (
                <RentalCard key={rental.id} rental={rental} active={!isReturned(rental)} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-white/15 dark:bg-white/[0.03]">
              <CarFront className="mx-auto text-slate-300 dark:text-slate-600" size={42} />
              <h3 className="mt-4 font-bold">Aucune location enregistrée</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Les futures locations de ce locataire apparaîtront ici.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
