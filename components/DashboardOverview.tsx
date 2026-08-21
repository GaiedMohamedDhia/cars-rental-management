"use client";

import { Children, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CarFront,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ChevronDown,
  Gauge,
  Loader2,
  Info,
  LogOut,
  UserRound,
  UserPlus,
  Wrench,
  X,
} from "lucide-react";

import { DashboardChartsSection } from "@/components/DashboardChartsSection";
import { authAPI, authStorage, carsAPI, maintenanceAPI, rentalsAPI, rentersAPI } from "@/lib/api-client";
import { actualReturnDate, isReturned, plannedReturnDate } from "@/lib/rental-status";
import type { Car, Maintenance, Rental, Renter, User } from "@/types";

type DashboardNotification = {
  id: string;
  priority: number;
  title: string;
  message: string;
  tone: "danger" | "warning" | "maintenance" | "info";
  href: string;
  timeLabel: string;
};

function validDate(value?: string | null) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function normalize(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatDate(value?: string | null) {
  const date = validDate(value);
  return date ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date) : "—";
}

function formatMoney(value: number) {
  return `${new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 2 }).format(value)} TND`;
}

function validAmount(value: number | null | undefined) {
  const amount = Number(value);
  return value !== null && value !== undefined && Number.isFinite(amount) && amount >= 0
    ? amount
    : null;
}

export default function DashboardOverview() {
  const router = useRouter();
  const [cars, setCars] = useState<Car[]>([]);
  const [renters, setRenters] = useState<Renter[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [readNotifications, setReadNotifications] = useState<string[]>([]);
  const [dismissedNotifications, setDismissedNotifications] = useState<string[]>([]);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  async function loadData() {
    setLoading(true);
    setError("");
    const [carsResult, rentersResult, rentalsResult, maintenanceResult, userResult] = await Promise.all([
      carsAPI.getAll(),
      rentersAPI.getAll(),
      rentalsAPI.getAll(),
      maintenanceAPI.getAll(),
      authAPI.me(),
    ]);
    setCars(carsResult.data || []);
    setRenters(rentersResult.data || []);
    setRentals(rentalsResult.data || []);
    setMaintenances(maintenanceResult.data || []);
    setUser(userResult.data || null);
    if (!carsResult.success || !rentersResult.success || !rentalsResult.success || !maintenanceResult.success) {
      setError("Certaines données du tableau de bord n’ont pas pu être chargées.");
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
    const syncUser = (event: Event) => setUser((event as CustomEvent<User>).detail);
    window.addEventListener("user-profile-updated", syncUser);
    try {
      setReadNotifications(JSON.parse(localStorage.getItem("dashboard-notifications-read") || "[]"));
      setDismissedNotifications(JSON.parse(localStorage.getItem("dashboard-notifications-dismissed") || "[]"));
    } catch {
      setReadNotifications([]);
      setDismissedNotifications([]);
    }
    return () => window.removeEventListener("user-profile-updated", syncUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    try {
      if (sessionStorage.getItem("show-login-welcome") !== "1") return;
      sessionStorage.removeItem("show-login-welcome");
      setToastVisible(true);
      const timeout = window.setTimeout(() => setToastVisible(false), 4500);
      return () => window.clearTimeout(timeout);
    } catch {
      return;
    }
  }, [user]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const closePanel = (event: MouseEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationsOpen(false);
    };
    document.addEventListener("mousedown", closePanel);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closePanel);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    if (!profileOpen) return;
    const close = (event: MouseEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [profileOpen]);

  const data = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const returned = rentals.filter(isReturned);
    const open = rentals.filter((rental) => !isReturned(rental));
    const overdue = rentals.filter((rental) => {
      const end = plannedReturnDate(rental);
      return !isReturned(rental) && Boolean(end && end < startOfToday);
    });
    const returnsToday = rentals.filter((rental) => {
      const end = plannedReturnDate(rental);
      return (
        !isReturned(rental) &&
        Boolean(end && end >= startOfToday && end < startOfTomorrow)
      );
    });
    const active = open.filter((rental) => {
      const end = plannedReturnDate(rental);
      return !end || end >= startOfToday;
    });
    const newRentalsThisMonth = rentals.filter((rental) => {
      const date = validDate(rental.dateDebut);
      return date && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    });
    const maintenanceCarIds = new Set(
      maintenances
        .filter((item) => normalize(item.statut) === "en cours")
        .map((item) => item.car_id),
    );
    const knownCarIds = new Set(cars.map((car) => car.id));
    const occupiedCarIds = new Set(
      open
        .map((rental) => rental.carId)
        .filter((carId) => knownCarIds.has(carId) && !maintenanceCarIds.has(carId)),
    );
    const rentedCars = occupiedCarIds.size;
    const availableCars = cars.filter(
      (car) => !occupiedCarIds.has(car.id) && !maintenanceCarIds.has(car.id),
    ).length;
    const occupationRate = cars.length ? Math.round((rentedCars / cars.length) * 100) : 0;
    const monthlyRevenue = newRentalsThisMonth.reduce(
      (sum, rental) => sum + (validAmount(rental.montantTotal) ?? 0),
      0,
    );
    const paidRentals = rentals
      .map((rental) => validAmount(rental.montantTotal))
      .filter((amount): amount is number => amount !== null);
    const averageRevenue = paidRentals.length
      ? paidRentals.reduce((sum, amount) => sum + amount, 0) / paidRentals.length
      : 0;
    const newRenters = renters.filter((renter) => {
      const date = validDate(renter.createdAt);
      return date && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;
    const completedMaintenanceToday = maintenances.filter((item) => {
      const date = validDate(item.updated_at);
      return normalize(item.statut) === "terminee" && Boolean(date && date >= startOfToday && date < startOfTomorrow);
    });
    const newRentalsToday = rentals.filter((rental) => {
      const date = validDate(rental.createdAt || rental.dateDebut);
      return Boolean(date && date >= startOfToday && date < startOfTomorrow);
    });
    const returnedToday = returned.filter((rental) => {
      const date = actualReturnDate(rental);
      return Boolean(date && date >= startOfToday && date < startOfTomorrow);
    });

    return {
      active,
      overdue,
      completed: returned,
      returnsToday,
      newRentalsThisMonth,
      maintenanceCarIds,
      rentedCars,
      availableCars,
      occupationRate,
      monthlyRevenue,
      averageRevenue,
      newRenters,
      completedMaintenanceToday,
      newRentalsToday,
      returnedToday,
    };
  }, [cars, maintenances, rentals, renters]);

  const notifications = useMemo<DashboardNotification[]>(() => {
    const items: DashboardNotification[] = [];
    if (data.overdue.length) items.push({
      id: `overdue:${data.overdue.map((item) => item.id).sort().join(",")}`,
      priority: 1,
      title: "Locations en retard",
      message: `${data.overdue.length} véhicule(s) n’ont pas été retourné(s) après l’échéance.`,
      tone: "danger",
      href: "/rentals",
      timeLabel: "À traiter maintenant",
    });
    if (data.returnsToday.length) items.push({
      id: `returns-today:${data.returnsToday.map((item) => item.id).sort().join(",")}`,
      priority: 2,
      title: "Retours prévus aujourd’hui",
      message: `${data.returnsToday.length} retour(s) de véhicule à traiter aujourd’hui.`,
      tone: "warning",
      href: "/rentals",
      timeLabel: "Aujourd’hui",
    });
    if (data.maintenanceCarIds.size) items.push({
      id: `maintenance-active:${Array.from(data.maintenanceCarIds).sort().join(",")}`,
      priority: 3,
      title: "Véhicules en maintenance",
      message: `${data.maintenanceCarIds.size} véhicule(s) actuellement indisponible(s).`,
      tone: "maintenance",
      href: "/maintenance",
      timeLabel: "En cours",
    });
    if (data.completedMaintenanceToday.length) items.push({
      id: `maintenance-completed:${data.completedMaintenanceToday.map((item) => item.id).sort().join(",")}`,
      priority: 3,
      title: "Maintenance terminée",
      message: `${data.completedMaintenanceToday.length} intervention(s) terminée(s) aujourd’hui.`,
      tone: "maintenance",
      href: "/maintenance",
      timeLabel: "Aujourd’hui",
    });
    if (data.newRentalsToday.length) items.push({
      id: `new-rentals:${data.newRentalsToday.map((item) => item.id).sort().join(",")}`,
      priority: 5,
      title: "Nouvelles locations",
      message: `${data.newRentalsToday.length} nouvelle(s) location(s) enregistrée(s) aujourd’hui.`,
      tone: "info",
      href: "/rentals",
      timeLabel: "Aujourd’hui",
    });
    if (data.returnedToday.length) items.push({
      id: `returned-today:${data.returnedToday.map((item) => item.id).sort().join(",")}`,
      priority: 5,
      title: "Véhicules disponibles après retour",
      message: `${data.returnedToday.length} véhicule(s) retourné(s) aujourd’hui.`,
      tone: "info",
      href: "/rentals",
      timeLabel: "Aujourd’hui",
    });
    return items
      .filter((item) => !dismissedNotifications.includes(item.id))
      .sort((a, b) => a.priority - b.priority);
  }, [data, dismissedNotifications]);

  const unreadCount = notifications.filter((item) => !readNotifications.includes(item.id)).length;
  const userName = [user?.prenom?.trim(), user?.nom?.trim()].filter(Boolean).join(" ") || user?.username?.trim() || "";
  const initials = [user?.prenom, user?.nom].filter(Boolean).map((value) => value!.trim()[0]).join("").slice(0, 2).toUpperCase() || "U";

  function markNotificationRead(id: string) {
    const next = Array.from(new Set([...readNotifications, id]));
    setReadNotifications(next);
    try { localStorage.setItem("dashboard-notifications-read", JSON.stringify(next)); } catch {}
  }

  function dismissNotification(id: string) {
    const next = Array.from(new Set([...dismissedNotifications, id]));
    setDismissedNotifications(next);
    try { localStorage.setItem("dashboard-notifications-dismissed", JSON.stringify(next)); } catch {}
  }

  const kpis = [
    { label: "Taux d’occupation", value: `${data.occupationRate} %`, detail: `${data.rentedCars} véhicule(s) loué(s)`, icon: Gauge, tone: "text-sky-600 bg-sky-50" },
    { label: "Véhicules disponibles", value: data.availableCars, detail: `sur ${cars.length} véhicules`, icon: CarFront, tone: "text-emerald-600 bg-emerald-50" },
    { label: "En maintenance", value: data.maintenanceCarIds.size, detail: "interventions en cours", icon: Wrench, tone: "text-violet-600 bg-violet-50" },
    { label: "Retours aujourd’hui", value: data.returnsToday.length, detail: "à traiter aujourd’hui", icon: CalendarClock, tone: "text-amber-600 bg-amber-50" },
    { label: "Revenu du mois", value: formatMoney(data.monthlyRevenue), detail: "locations démarrées ce mois", icon: CircleDollarSign, tone: "text-emerald-600 bg-emerald-50" },
    { label: "Revenu moyen", value: formatMoney(data.averageRevenue), detail: "par location renseignée", icon: CircleDollarSign, tone: "text-indigo-600 bg-indigo-50" },
    { label: "Nouveaux locataires", value: data.newRenters, detail: "inscrits ce mois", icon: UserPlus, tone: "text-fuchsia-600 bg-fuchsia-50" },
    { label: "Nouvelles locations", value: data.newRentalsThisMonth.length, detail: "créées ce mois", icon: Clock3, tone: "text-blue-600 bg-blue-50" },
    { label: "Locations terminées", value: data.completed.length, detail: "véhicules retournés", icon: CheckCircle2, tone: "text-teal-600 bg-teal-50" },
    { label: "Locations en retard", value: data.overdue.length, detail: "non retournées après l’échéance", icon: AlertTriangle, tone: "text-red-600 bg-red-50" },
  ];

  const latestRentals = [...rentals]
    .sort((a, b) => (validDate(b.dateDebut)?.getTime() || 0) - (validDate(a.dateDebut)?.getTime() || 0))
    .slice(0, 5);
  const latestMaintenance = [...maintenances]
    .sort((a, b) => (validDate(b.created_at)?.getTime() || 0) - (validDate(a.created_at)?.getTime() || 0))
    .slice(0, 5);
  const upcomingReturns = [...data.active]
    .filter((rental) => plannedReturnDate(rental))
    .sort((a, b) => (plannedReturnDate(a)?.getTime() || 0) - (plannedReturnDate(b)?.getTime() || 0))
    .slice(0, 5);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500"><Loader2 className="animate-spin" /> Chargement du tableau de bord…</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      {toastVisible ? (
        <div className="fixed right-4 top-4 z-[120] flex max-w-sm animate-[fadeIn_.25s_ease-out] items-start gap-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl shadow-emerald-900/10">
          <span className="rounded-xl bg-emerald-50 p-2 text-emerald-600"><CheckCircle2 size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-slate-900">Bienvenue{userName ? `, ${userName}` : ""} !</p>
            <p className="mt-0.5 text-xs text-slate-500">Connexion réussie.</p>
          </div>
          <button type="button" onClick={() => setToastVisible(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Fermer">
            <X size={15} />
          </button>
        </div>
      ) : null}
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">
              Bienvenue{userName ? ` ${userName}` : ""} <span aria-hidden>👋</span>
            </h1>
            <p className="mt-1 text-sm text-slate-500">Voici un aperçu de votre activité aujourd’hui.</p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <div ref={notificationsRef} className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((value) => !value)}
                aria-label="Ouvrir les notifications"
                aria-expanded={notificationsOpen}
                className="relative grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-600 hover:shadow-md"
              >
                <Bell size={19} />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-[#f6f8fb] bg-red-500 px-1 text-[10px] font-black text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </button>

              {notificationsOpen ? (
                <div className="absolute right-0 top-14 z-50 w-[min(92vw,390px)] animate-[fadeIn_.2s_ease-out] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div>
                      <h2 className="font-black text-slate-900">Notifications</h2>
                      <p className="text-xs text-slate-400">{unreadCount} non lue{unreadCount === 1 ? "" : "s"}</p>
                    </div>
                    {unreadCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => notifications.forEach((item) => markNotificationRead(item.id))}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800"
                      >
                        Tout marquer comme lu
                      </button>
                    ) : null}
                  </div>

                  {notifications.length ? (
                    <div className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
                      {notifications.map((notification) => {
                        const isRead = readNotifications.includes(notification.id);
                        const Icon = notification.tone === "danger"
                          ? AlertTriangle
                          : notification.tone === "warning"
                            ? CalendarClock
                            : notification.tone === "maintenance"
                              ? Wrench
                              : Info;
                        const iconStyle = {
                          danger: "bg-red-50 text-red-600",
                          warning: "bg-amber-50 text-amber-600",
                          maintenance: "bg-violet-50 text-violet-600",
                          info: "bg-blue-50 text-blue-600",
                        }[notification.tone];
                        return (
                          <article key={notification.id} className={`relative flex gap-3 p-3.5 transition hover:bg-slate-50 ${isRead ? "opacity-65" : "bg-blue-50/20"}`}>
                            {!isRead ? <span className="absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-blue-500" /> : null}
                            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${iconStyle}`}><Icon size={16} /></span>
                            <Link
                              href={notification.href}
                              onClick={() => {
                                markNotificationRead(notification.id);
                                setNotificationsOpen(false);
                              }}
                              className="min-w-0 flex-1"
                            >
                              <p className="text-sm font-black text-slate-800">{notification.title}</p>
                              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{notification.message}</p>
                              <p className="mt-1 text-[10px] font-semibold text-slate-400">{notification.timeLabel}</p>
                            </Link>
                            <div className="flex shrink-0 items-start gap-0.5">
                              {!isRead ? (
                                <button type="button" onClick={() => markNotificationRead(notification.id)} title="Marquer comme lue" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"><Check size={13} /></button>
                              ) : null}
                              <button type="button" onClick={() => dismissNotification(notification.id)} title="Supprimer" className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><X size={13} /></button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-5 py-10 text-center">
                      <Bell className="mx-auto text-slate-300" size={28} />
                      <p className="mt-3 text-sm font-bold text-slate-500">Aucune nouvelle notification</p>
                    </div>
                  )}
                  <Link href="/rentals" onClick={() => setNotificationsOpen(false)} className="block border-t border-slate-100 px-4 py-3 text-center text-xs font-bold text-blue-600 transition hover:bg-slate-50">
                    Voir toutes les notifications
                  </Link>
                </div>
              ) : null}
            </div>
            <div ref={profileRef} className="relative">
              <button type="button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen} aria-haspopup="menu" className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-2 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md sm:pr-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-xs font-black text-slate-600">
                  {user?.photoUrl ? <img src={user.photoUrl} alt={userName} className="h-full w-full object-cover" /> : initials}
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className="block max-w-40 truncate text-xs font-black text-slate-800">{userName || "Utilisateur"}</span>
                  {user?.poste ? <span className="block max-w-40 truncate text-[10px] text-slate-400">{user.poste}</span> : null}
                </span>
                <ChevronDown size={13} className={`hidden text-slate-400 transition sm:block ${profileOpen ? "rotate-180" : ""}`} />
              </button>
              {profileOpen ? (
                <div role="menu" className="absolute right-0 top-14 z-50 w-56 animate-[fadeIn_.16s_ease-out] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl shadow-slate-900/15">
                  <div className="border-b border-slate-100 px-3 py-2">
                    <p className="truncate text-xs font-black text-slate-800">{userName}</p>
                    {user?.poste ? <p className="truncate text-[10px] text-slate-400">{user.poste}</p> : null}
                  </div>
                  <Link href="/profile" onClick={() => setProfileOpen(false)} role="menuitem" className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><UserRound size={15} /> Mon Profil</Link>
                  <button type="button" role="menuitem" onClick={() => { authStorage.clearToken(); setProfileOpen(false); router.push("/login"); router.refresh(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"><LogOut size={15} /> Déconnexion</button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {error ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div> : null}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {kpis.map(({ label, value, detail, icon: Icon, tone }) => (
            <div key={label} className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start gap-3">
                <div className={`rounded-xl p-2.5 ${tone}`}><Icon size={19} /></div>
              </div>
              <p className="mt-3 text-2xl font-black tracking-tight">{value}</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">{label}</p>
              <p className="mt-1 text-[11px] text-slate-400">{detail}</p>
            </div>
          ))}
        </section>

        <DashboardChartsSection
          rentals={rentals}
          maintenances={maintenances}
          availableCars={data.availableCars}
          rentedCars={data.rentedCars}
          maintenanceCars={data.maintenanceCarIds.size}
          activeRentals={data.active.length}
          completedRentals={data.completed.length}
          overdueRentals={data.overdue.length}
        />

        <section className="mt-5 grid gap-4 xl:grid-cols-3">
          <InfoPanel title="Dernières locations" icon={<Clock3 size={17} />} href="/rentals">
            {latestRentals.map((rental) => (
              <InfoRow key={rental.id} title={`${rental.car?.marque || "Voiture"} ${rental.car?.modele || `#${rental.carId}`}`} subtitle={`${rental.renter?.prenom || ""} ${rental.renter?.nom || ""}`} meta={formatDate(rental.dateDebut)} />
            ))}
          </InfoPanel>
          <InfoPanel title="Dernières maintenances" icon={<Wrench size={17} />} href="/maintenance">
            {latestMaintenance.map((item) => (
              <InfoRow key={item.id} title={item.car ? `${item.car.marque} ${item.car.modele}` : `Voiture #${item.car_id}`} subtitle={item.type_maintenance} meta={item.statut} />
            ))}
          </InfoPanel>
          <InfoPanel title="Prochains retours" icon={<CalendarClock size={17} />} href="/rentals">
            {upcomingReturns.map((rental) => (
              <InfoRow key={rental.id} title={`${rental.car?.marque || "Voiture"} ${rental.car?.modele || `#${rental.carId}`}`} subtitle={`${rental.renter?.prenom || ""} ${rental.renter?.nom || ""}`} meta={formatDate(plannedReturnDate(rental)?.toISOString())} />
            ))}
          </InfoPanel>
        </section>

      </div>
    </main>
  );
}

function InfoPanel({ title, icon, href, children }: { title: string; icon: ReactNode; href: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-black">{icon}{title}</h2>
        <Link href={href} className="text-xs font-bold text-blue-600 hover:text-blue-700">Tout voir →</Link>
      </div>
      <div className="divide-y divide-slate-100">
        {Children.count(children) > 0 ? children : <p className="py-6 text-center text-sm text-slate-400">Aucune donnée</p>}
      </div>
    </div>
  );
}

function InfoRow({ title, subtitle, meta }: { title: string; subtitle: string; meta: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0"><p className="truncate text-sm font-bold">{title}</p><p className="truncate text-xs text-slate-400">{subtitle || "Non renseigné"}</p></div>
      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{meta}</span>
    </div>
  );
}
