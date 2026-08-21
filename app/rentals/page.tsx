"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CarFront,
  CheckCircle2,
  Eye,
  Gauge,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import { rentalsAPI } from "@/lib/api-client";
import {
  actualReturnDate,
  getRentalReturnStatus,
  getReturnDelay,
  isReturned,
  plannedReturnDate,
  rentalDate,
  type RentalReturnStatus,
} from "@/lib/rental-status";
import type { Rental } from "@/types";

const statusStyle: Record<RentalReturnStatus, string> = {
  Active: "border-sky-200 bg-sky-50 text-sky-700",
  "À retourner aujourd’hui": "border-amber-200 bg-amber-50 text-amber-700",
  "En retard": "border-red-200 bg-red-50 text-red-700",
  "Retournée à temps": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Retournée en retard": "border-orange-200 bg-orange-50 text-orange-700",
};

function formatDate(value?: string | null, withTime = false) {
  const date = rentalDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
}

function daysBetween(startValue?: string | null, endValue?: string | null) {
  const start = rentalDate(startValue);
  const end = rentalDate(endValue) || new Date();
  if (!start) return 0;
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
}

export default function RentalsPage() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState<"active" | "history">("active");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [renterFilter, setRenterFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [sort, setSort] = useState("date-desc");
  const [page, setPage] = useState(1);
  const [returning, setReturning] = useState<Rental | null>(null);
  const [kmFin, setKmFin] = useState("");
  const [saving, setSaving] = useState(false);
  const pageSize = 8;

  async function loadRentals() {
    setLoading(true);
    const result = await rentalsAPI.getAll();
    setRentals(result.data || []);
    setError(result.success ? "" : result.error || "Impossible de charger les locations.");
    setLoading(false);
  }

  useEffect(() => { void loadRentals(); }, []);

  const activeRentals = rentals.filter((rental) => !isReturned(rental));
  const completedRentals = rentals.filter(isReturned);
  const overdueCount = activeRentals.filter((rental) => getRentalReturnStatus(rental) === "En retard").length;
  const history = useMemo(() => {
    const query = search.trim().toLowerCase();
    return completedRentals
      .filter((rental) => {
        const status = getRentalReturnStatus(rental);
        const text = `${rental.car?.marque || ""} ${rental.car?.modele || ""} ${rental.car?.numImma || ""} ${rental.renter?.prenom || ""} ${rental.renter?.nom || ""}`.toLowerCase();
        const returnedAt = actualReturnDate(rental);
        const now = new Date();
        const matchesPeriod =
          periodFilter === "all" ||
          (periodFilter === "month" &&
            returnedAt?.getMonth() === now.getMonth() &&
            returnedAt?.getFullYear() === now.getFullYear()) ||
          (periodFilter === "year" && returnedAt?.getFullYear() === now.getFullYear());
        return (
          (!query || text.includes(query)) &&
          (statusFilter === "all" || status === statusFilter) &&
          (vehicleFilter === "all" || rental.carId === Number(vehicleFilter)) &&
          (renterFilter === "all" || rental.renterId === Number(renterFilter)) &&
          matchesPeriod
        );
      })
      .sort((a, b) => {
        if (sort === "amount-desc") return (b.montantTotal ?? 0) - (a.montantTotal ?? 0);
        if (sort === "amount-asc") return (a.montantTotal ?? 0) - (b.montantTotal ?? 0);
        const aDate = actualReturnDate(a)?.getTime() || 0;
        const bDate = actualReturnDate(b)?.getTime() || 0;
        return sort === "date-asc" ? aDate - bDate : bDate - aDate;
      });
  }, [completedRentals, periodFilter, renterFilter, search, sort, statusFilter, vehicleFilter]);
  const totalPages = Math.max(1, Math.ceil(history.length / pageSize));
  const pageRows = history.slice((page - 1) * pageSize, page * pageSize);

  async function finishRental(event: React.FormEvent) {
    event.preventDefault();
    if (!returning) return;
    const finalMileage = Number(kmFin);
    if (!Number.isInteger(finalMileage) || finalMileage < returning.kmDebut) {
      setError(`Le kilométrage final doit être supérieur ou égal à ${returning.kmDebut} km.`);
      return;
    }
    if (!window.confirm("Confirmer la clôture de cette location ?")) return;
    setSaving(true);
    const actual = new Date();
    const days = daysBetween(returning.dateDebut, actual.toISOString());
    const result = await rentalsAPI.update(returning.id, {
      dateRetourReelle: actual.toISOString(),
      kmFin: finalMileage,
      montantTotal: days * (returning.car?.prixLocation || 0),
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error || "La clôture a échoué.");
      return;
    }
    setReturning(null);
    setKmFin("");
    setSuccess("Location terminée et retour réel enregistré.");
    await loadRentals();
  }

  async function deleteRental(id: number) {
    if (!window.confirm(
      "Supprimer définitivement cette location et ses paiements associés ? La voiture redeviendra disponible."
    )) return;
    setError("");
    const result = await rentalsAPI.delete(id);
    if (!result.success) setError(result.error || "Suppression impossible.");
    else {
      setRentals((items) => items.filter((item) => item.id !== id));
      setSuccess(
        result.data?.message ||
        "Location supprimée et voiture remise en disponibilité."
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Gestion des Locations</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-700">{activeRentals.length} actives</span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">{completedRentals.length} terminées</span>
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-700">{overdueCount} en retard</span>
            </div>
          </div>
          <Link href="/rentals/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-md shadow-emerald-200 transition hover:-translate-y-0.5 hover:bg-emerald-700">
            <Plus size={17} /> Nouvelle location
          </Link>
        </header>

        {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

        <nav className="mt-5 flex border-b border-slate-200">
          {(["active", "history"] as const).map((item) => (
            <button key={item} onClick={() => setTab(item)} className={`relative px-4 py-2.5 text-sm font-bold transition ${tab === item ? "text-emerald-700" : "text-slate-400 hover:text-slate-700"}`}>
              {item === "active" ? "Actives" : "Historique"}
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{item === "active" ? activeRentals.length : completedRentals.length}</span>
              {tab === item ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-emerald-500" /> : null}
            </button>
          ))}
        </nav>

        {loading ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">{[1, 2, 3, 4].map((item) => <div key={item} className="h-64 animate-pulse rounded-2xl bg-slate-200" />)}</div>
        ) : tab === "active" ? (
          activeRentals.length ? (
            <section className="mt-5 grid gap-4 lg:grid-cols-2">
              {activeRentals.map((rental) => <ActiveRentalCard key={rental.id} rental={rental} onReturn={() => { setReturning(rental); setKmFin(String(rental.kmDebut)); }} onDelete={() => void deleteRental(rental.id)} />)}
            </section>
          ) : <EmptyState text="Aucune location active." />
        ) : (
          <section className="mt-5">
            <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
              <div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Voiture, locataire, immatriculation…" className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-emerald-400" /></div>
              <select value={vehicleFilter} onChange={(event) => { setVehicleFilter(event.target.value); setPage(1); }} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="all">Tous les véhicules</option>{Array.from(new Map(completedRentals.filter((rental) => rental.car).map((rental) => [rental.carId, rental.car!])).entries()).map(([id, car]) => <option key={id} value={id}>{car.marque} {car.modele}</option>)}</select>
              <select value={renterFilter} onChange={(event) => { setRenterFilter(event.target.value); setPage(1); }} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="all">Tous les locataires</option>{Array.from(new Map(completedRentals.filter((rental) => rental.renter).map((rental) => [rental.renterId, rental.renter!])).entries()).map(([id, renter]) => <option key={id} value={id}>{renter.prenom} {renter.nom}</option>)}</select>
              <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="all">Tous les statuts</option><option>Retournée à temps</option><option>Retournée en retard</option></select>
              <select value={periodFilter} onChange={(event) => { setPeriodFilter(event.target.value); setPage(1); }} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="all">Toutes les périodes</option><option value="month">Ce mois</option><option value="year">Cette année</option></select>
              <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="date-desc">Plus récentes</option><option value="date-asc">Plus anciennes</option><option value="amount-desc">Montant décroissant</option><option value="amount-asc">Montant croissant</option></select>
            </div>
            {pageRows.length ? <HistoryTable rentals={pageRows} onDelete={deleteRental} /> : <EmptyState text="Aucun retour ne correspond aux filtres." />}
            {history.length > 0 ? <div className="mt-3 flex items-center justify-between text-sm text-slate-500"><span>Page {page} sur {totalPages}</span><div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border bg-white px-3 py-1.5 disabled:opacity-30">Précédent</button><button disabled={page === totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border bg-white px-3 py-1.5 disabled:opacity-30">Suivant</button></div></div> : null}
          </section>
        )}
      </div>

      {returning ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <form onSubmit={finishRental} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase text-emerald-600">Retour du véhicule</p><h2 className="mt-1 text-xl font-black">{returning.car?.marque} {returning.car?.modele}</h2></div><button type="button" onClick={() => setReturning(null)} className="rounded-lg p-2 hover:bg-slate-100"><X size={18} /></button></div>
            <label className="mt-5 block text-sm font-bold">Kilométrage final<input autoFocus type="number" min={returning.kmDebut} value={kmFin} onChange={(event) => setKmFin(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-400" required /></label>
            <p className="mt-2 text-xs text-slate-500">Départ : {returning.kmDebut.toLocaleString()} km. La date et l’heure du retour seront enregistrées automatiquement.</p>
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setReturning(null)} className="h-10 rounded-xl border px-4 text-sm font-bold">Annuler</button><button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />} Terminer la location</button></div>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function ActiveRentalCard({ rental, onReturn, onDelete }: { rental: Rental; onReturn: () => void; onDelete: () => void }) {
  const status = getRentalReturnStatus(rental);
  const planned = plannedReturnDate(rental);
  const remaining = planned ? Math.ceil((planned.getTime() - Date.now()) / 86_400_000) : null;
  const days = daysBetween(rental.dateDebut, new Date().toISOString());
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`h-1 ${status === "En retard" ? "bg-red-500" : status === "À retourner aujourd’hui" ? "bg-amber-500" : "bg-sky-500"}`} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="rounded-xl bg-slate-100 p-2.5 text-slate-600"><CarFront size={20} /></span><div><h2 className="font-black">{rental.car?.marque} {rental.car?.modele}</h2><p className="text-xs text-slate-400">{rental.car?.numImma || "Sans immatriculation"}</p></div></div><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyle[status]}`}>{status}</span></div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Info icon={<UserRound size={15} />} label="Locataire" value={`${rental.renter?.prenom || ""} ${rental.renter?.nom || ""}`} />
          <Info icon={<CalendarDays size={15} />} label="Retour prévu" value={formatDate(rental.dateFinPrevue || rental.dateFin)} emphasis={status === "En retard" ? "danger" : status === "À retourner aujourd’hui" || (remaining !== null && remaining <= 2) ? "warning" : undefined} />
          <Info icon={<Gauge size={15} />} label="Kilométrage départ" value={`${rental.kmDebut.toLocaleString()} km`} />
          <Info icon={<CalendarDays size={15} />} label="Durée" value={`${days} jour(s)`} />
          <Info icon={<CalendarDays size={15} />} label="Jours restants" value={remaining === null ? "Non défini" : remaining < 0 ? `${Math.abs(remaining)} jour(s) de retard` : `${remaining} jour(s)`} emphasis={remaining !== null && remaining < 0 ? "danger" : undefined} />
          <Info icon={<Gauge size={15} />} label="Montant estimé" value={rental.montantTotal == null ? "Non renseigné" : `${rental.montantTotal.toFixed(2)} TND`} />
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
          <Link href={`/rentals/${rental.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold hover:bg-slate-50"><Eye size={14} /> Détails</Link>
          <Link href={`/rentals/${rental.id}/edit`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold hover:bg-slate-50"><Pencil size={14} /> Modifier</Link>
          <button onClick={onReturn} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700"><CheckCircle2 size={14} /> Terminer</button>
          <button onClick={onDelete} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-600 hover:bg-red-50"><Trash2 size={14} /> Supprimer</button>
        </div>
      </div>
    </article>
  );
}

function Info({ icon, label, value, emphasis }: { icon: React.ReactNode; label: string; value: string; emphasis?: "danger" | "warning" }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="flex items-center gap-1.5 text-xs text-slate-400">{icon}{label}</p><p className={`mt-1 truncate text-xs font-bold ${emphasis === "danger" ? "text-red-600" : emphasis === "warning" ? "text-amber-600" : "text-slate-700"}`}>{value || "Non renseigné"}</p></div>;
}

function HistoryTable({ rentals, onDelete }: { rentals: Rental[]; onDelete: (id: number) => void }) {
  return <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="hidden overflow-x-auto md:block"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-400"><tr>{["Voiture", "Locataire", "Retour prévu", "Retour réel", "Kilométrage", "Montant", "Statut", "Actions"].map((title) => <th key={title} className="px-4 py-3 text-left">{title}</th>)}</tr></thead><tbody>{rentals.map((rental) => { const status = getRentalReturnStatus(rental); return <tr key={rental.id} className="border-t border-slate-100 hover:bg-slate-50/70"><td className="px-4 py-3 font-bold">{rental.car?.marque} {rental.car?.modele}<small className="block font-normal text-slate-400">{rental.car?.numImma}</small></td><td className="px-4 py-3">{rental.renter?.prenom} {rental.renter?.nom}</td><td className="px-4 py-3">{formatDate(rental.dateFinPrevue || rental.dateFin, true)}</td><td className="px-4 py-3">{formatDate(rental.dateRetourReelle, true)}<small className="block text-slate-400">{getReturnDelay(rental).label}</small></td><td className="px-4 py-3">{rental.kmDebut} → {rental.kmFin ?? "—"} km</td><td className="px-4 py-3 font-bold">{rental.montantTotal?.toFixed(2) ?? "—"} TND</td><td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 text-xs font-bold ${statusStyle[status]}`}>{status}</span></td><td className="px-4 py-3"><div className="flex gap-2"><Link href={`/rentals/${rental.id}`} className="rounded-lg border p-2"><Eye size={14} /></Link><button onClick={() => void onDelete(rental.id)} className="rounded-lg border border-red-200 p-2 text-red-600"><Trash2 size={14} /></button></div></td></tr>; })}</tbody></table></div><div className="divide-y md:hidden">{rentals.map((rental) => { const status = getRentalReturnStatus(rental); return <div key={rental.id} className="p-4"><div className="flex justify-between gap-3"><div><p className="font-bold">{rental.car?.marque} {rental.car?.modele}</p><p className="text-xs text-slate-400">{rental.renter?.prenom} {rental.renter?.nom}</p></div><span className={`h-fit rounded-full border px-2 py-1 text-[10px] font-bold ${statusStyle[status]}`}>{status}</span></div><p className="mt-3 text-xs text-slate-500">Prévu : {formatDate(rental.dateFinPrevue || rental.dateFin, true)}</p><p className="text-xs text-slate-500">Réel : {formatDate(rental.dateRetourReelle, true)} · {getReturnDelay(rental).label}</p><Link href={`/rentals/${rental.id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><Eye size={13} /> Voir les détails</Link></div>; })}</div></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><CarFront className="mx-auto text-slate-300" size={38} /><p className="mt-3 text-sm font-bold text-slate-500">{text}</p></div>;
}
