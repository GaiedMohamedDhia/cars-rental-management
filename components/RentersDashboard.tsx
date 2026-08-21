"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays, ChevronDown, Eye, Filter, Mail, MapPin, Pencil,
  Phone, Search, Trash2, UserPlus, UsersRound, X,
} from "lucide-react";
import type { Rental, Renter } from "@/types";
import { rentersAPI } from "@/lib/api-client";
import { isReturned } from "@/lib/rental-status";
import { resolveMediaUrl } from "@/lib/media-url";

type Props = { initialRenters: Renter[]; rentals: Rental[]; loadError?: string };
type StatusFilter = "all" | "active" | "inactive" | "new";

const dateLabel = (value?: string | null) => {
  if (!value) return "Date inconnue";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date inconnue"
    : `Client depuis ${new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date)}`;
};

const initials = (renter: Renter) =>
  `${renter.prenom?.[0] ?? ""}${renter.nom?.[0] ?? ""}`.toUpperCase() || "?";

export default function RentersDashboard({ initialRenters, rentals, loadError }: Props) {
  const router = useRouter();
  const filterRef = useRef<HTMLDetailsElement>(null);
  const [renters, setRenters] = useState(initialRenters);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [registered, setRegistered] = useState("");
  const [minimumRentals, setMinimumRentals] = useState("");
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const rentalCount = useMemo(() => {
    const map = new Map<number, number>();
    rentals.forEach((rental) => map.set(rental.renterId, (map.get(rental.renterId) ?? 0) + 1));
    return map;
  }, [rentals]);
  const activeIds = useMemo(
    () => new Set(rentals.filter((rental) => !isReturned(rental)).map((rental) => rental.renterId)),
    [rentals],
  );
  const thisMonth = (value?: string | null) => {
    if (!value) return false;
    const date = new Date(value);
    const now = new Date();
    return !Number.isNaN(date.getTime()) &&
      date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  };
  const filterActive = Boolean(city || registered || minimumRentals || status !== "all");
  const cities = useMemo(
    () => [...new Set(renters.map((renter) => renter.ville?.trim()).filter(Boolean) as string[])].sort(),
    [renters],
  );

  const visible = useMemo(() => renters.filter((renter) => {
    const searchText = [
      renter.nom, renter.prenom, renter.telephone, renter.email,
      renter.cin, renter.adresse, renter.ville,
    ].filter(Boolean).join(" ").toLocaleLowerCase("fr");
    const matchesQuery = searchText.includes(query.trim().toLocaleLowerCase("fr"));
    const count = rentalCount.get(renter.id) ?? 0;
    const matchesCity = !city || renter.ville === city;
    const matchesDate = !registered || (renter.createdAt?.slice(0, 10) ?? "") >= registered;
    const matchesCount = !minimumRentals || count >= Number(minimumRentals);
    const matchesStatus = status === "all" ||
      (status === "active" && activeIds.has(renter.id)) ||
      (status === "inactive" && !activeIds.has(renter.id)) ||
      (status === "new" && thisMonth(renter.createdAt));
    return matchesQuery && matchesCity && matchesDate && matchesCount && matchesStatus;
  }), [renters, query, city, registered, minimumRentals, status, rentalCount, activeIds]);

  const resetFilters = () => {
    setCity(""); setStatus("all"); setRegistered(""); setMinimumRentals("");
  };
  const removeRenter = async (renter: Renter) => {
    if (!window.confirm(
      `Retirer ${renter.prenom} ${renter.nom} de la liste active ? Son historique sera conservé si nécessaire.`
    )) return;
    setDeletingId(renter.id);
    const result = await rentersAPI.delete(renter.id);
    if (result.success) {
      setRenters((current) => current.filter((item) => item.id !== renter.id));
      setToast({
        kind: "success",
        message: result.data?.message || "Locataire supprimé avec succès.",
      });
      router.refresh();
    } else {
      setToast({ kind: "error", message: result.error || "La suppression a échoué." });
    }
    setDeletingId(null);
  };

  const statusBadge = (renter: Renter) => {
    if (activeIds.has(renter.id)) return <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-500">Location en cours</span>;
    if (thisMonth(renter.createdAt)) return <span className="rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-500">Nouveau client</span>;
    return <span className="rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:text-slate-300">Inactif</span>;
  };

  const actions = (renter: Renter) => (
    <div className="flex items-center justify-end gap-1">
      <Link href={`/locataires/${renter.id}`} aria-label="Voir les détails" title="Voir les détails" className="rounded-lg p-2 text-slate-500 transition hover:bg-sky-500/10 hover:text-sky-500"><Eye size={17} /></Link>
      <Link href={`/locataires/${renter.id}/edit`} aria-label="Modifier" title="Modifier" className="rounded-lg p-2 text-slate-500 transition hover:bg-violet-500/10 hover:text-violet-500"><Pencil size={17} /></Link>
      <button onClick={() => removeRenter(renter)} disabled={deletingId === renter.id} aria-label="Supprimer" title="Supprimer" className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-40"><Trash2 size={17} /></button>
    </div>
  );

  return (
    <main className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">Gestion des Locataires</h1><p className="mt-1 text-sm text-slate-500">Gérez vos clients</p></div>
        <Link href="/locataires/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:-translate-y-0.5 hover:bg-violet-500"><UserPlus size={17} />Ajouter un locataire</Link>
      </header>

      {toast && <div className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${toast.kind === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600" : "border-rose-500/20 bg-rose-500/10 text-rose-600"}`}><span>{toast.message}</span><button onClick={() => setToast(null)}><X size={16} /></button></div>}
      {loadError && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{loadError}</div>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Total locataires", renters.length, UsersRound],
          ["Nouveaux ce mois", renters.filter((r) => thisMonth(r.createdAt)).length, CalendarDays],
          ["Location active", activeIds.size, UserPlus],
          ["Locataires fidèles", renters.filter((r) => (rentalCount.get(r.id) ?? 0) >= 3).length, UsersRound],
        ].map(([label, value, Icon]) => {
          const StatIcon = Icon as typeof UsersRound;
          return <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-slate-900"><div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500"><StatIcon size={18} /></div><p className="text-2xl font-bold text-slate-950 dark:text-white">{String(value)}</p><p className="mt-1 text-xs text-slate-500">{String(label)}</p></article>;
        })}
      </section>

      <section className="flex items-center gap-2">
        <label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un locataire..." className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-white/10 dark:bg-slate-900 dark:text-white" /></label>
        <details ref={filterRef} className="group relative">
          <summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-violet-400 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"><Filter size={17} />Filtres{filterActive && <span className="h-2 w-2 rounded-full bg-violet-500" />}<ChevronDown size={15} /></summary>
          <div className="absolute right-0 z-30 mt-2 w-[min(90vw,360px)] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-slate-950 dark:text-white">Filtres</h2>{filterActive && <button onClick={resetFilters} className="text-xs font-semibold text-violet-500 hover:text-violet-400">Réinitialiser</button>}</div>
            <div className="grid gap-3">
              <select value={city} onChange={(e) => setCity(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"><option value="">Toutes les villes</option>{cities.map((item) => <option key={item}>{item}</option>)}</select>
              <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="h-10 rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"><option value="all">Tous les statuts</option><option value="active">Location en cours</option><option value="inactive">Inactif</option><option value="new">Nouveau client</option></select>
              <label className="text-xs text-slate-500">Inscrit depuis<input type="date" value={registered} onChange={(e) => setRegistered(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-transparent px-3 text-sm text-slate-900 dark:border-white/10 dark:text-white" /></label>
              <label className="text-xs text-slate-500">Nombre minimum de locations<input type="number" min="0" value={minimumRentals} onChange={(e) => setMinimumRentals(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-transparent px-3 text-sm text-slate-900 dark:border-white/10 dark:text-white" /></label>
            </div>
          </div>
        </details>
      </section>

      {visible.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-white/10 dark:bg-slate-900"><UsersRound className="mx-auto mb-3 text-slate-400" size={38} /><h2 className="font-semibold text-slate-950 dark:text-white">Aucun locataire trouvé</h2><p className="mt-1 text-sm text-slate-500">Modifiez votre recherche ou ajoutez un nouveau client.</p></section>
      ) : <>
        <section className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block dark:border-white/10 dark:bg-slate-900">
          <table className="w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-white/[.03]"><tr><th className="px-5 py-3">Locataire</th><th className="px-4 py-3">Téléphone</th><th className="px-4 py-3">E-mail</th><th className="px-4 py-3">Adresse</th><th className="px-4 py-3 text-center">Locations</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[.06]">{visible.map((renter) => <tr key={renter.id} className="transition hover:bg-slate-50 dark:hover:bg-white/[.03]"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-gradient-to-br from-violet-500 to-sky-500 font-bold text-white shadow-sm dark:border-white/15">{resolveMediaUrl(renter.photoUrl) ? <img src={resolveMediaUrl(renter.photoUrl)!} alt="" className="h-full w-full object-cover" /> : initials(renter)}</div><div><p className="font-semibold text-slate-950 dark:text-white">{renter.prenom} {renter.nom}</p><p className="text-xs text-slate-500">#{renter.id} · {dateLabel(renter.createdAt)}</p></div></div></td><td className="px-4 py-4 text-slate-600 dark:text-slate-300">{renter.telephone || "Non renseigné"}</td><td className="max-w-[190px] truncate px-4 py-4 text-slate-600 dark:text-slate-300">{renter.email || "Non renseigné"}</td><td className="max-w-[220px] truncate px-4 py-4 text-slate-600 dark:text-slate-300">{[renter.adresse, renter.ville].filter(Boolean).join(", ") || "Non renseigné"}</td><td className="px-4 py-4 text-center font-semibold">{rentalCount.get(renter.id) ?? 0}</td><td className="px-4 py-4">{statusBadge(renter)}</td><td className="px-4 py-4">{actions(renter)}</td></tr>)}</tbody>
          </table>
        </section>
        <section className="grid gap-3 md:hidden">{visible.map((renter) => <article key={renter.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-gradient-to-br from-violet-500 to-sky-500 font-bold text-white shadow-sm dark:border-white/15">{resolveMediaUrl(renter.photoUrl) ? <img src={resolveMediaUrl(renter.photoUrl)!} alt="" className="h-full w-full object-cover" /> : initials(renter)}</div><div><h2 className="font-semibold text-slate-950 dark:text-white">{renter.prenom} {renter.nom}</h2><p className="text-xs text-slate-500">{dateLabel(renter.createdAt)}</p></div></div>{statusBadge(renter)}</div><div className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-300">{renter.telephone && <span className="flex items-center gap-2"><Phone size={15} />{renter.telephone}</span>}{renter.email && <span className="flex items-center gap-2"><Mail size={15} />{renter.email}</span>}<span className="flex items-center gap-2"><MapPin size={15} />{[renter.adresse, renter.ville].filter(Boolean).join(", ") || "Non renseigné"}</span></div><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-white/[.06]"><span className="text-xs text-slate-500">{rentalCount.get(renter.id) ?? 0} location(s)</span>{actions(renter)}</div></article>)}</section>
      </>}
    </main>
  );
}
