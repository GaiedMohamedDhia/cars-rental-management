"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CarFront,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Wrench,
  X,
} from "lucide-react";

import MaintenanceAlerts from "@/components/MaintenanceAlerts";
import MaintenanceCharts from "@/components/MaintenanceCharts";
import MaintenanceHistory from "@/components/MaintenanceHistory";
import MaintenanceStatsCards from "@/components/MaintenanceStatsCards";
import { authStorage, carsAPI, maintenanceAPI } from "@/lib/api-client";
import type { Car, Maintenance } from "@/types";

type MaintenanceFormState = {
  car_id: string;
  type_maintenance: string;
  description: string;
  date_maintenance: string;
  cout: string;
  kilometrage: string;
  statut: string;
};

const emptyForm: MaintenanceFormState = {
  car_id: "",
  type_maintenance: "Vidange",
  description: "",
  date_maintenance: "",
  cout: "",
  kilometrage: "",
  statut: "Planifiée",
};

function createMaintenanceForm(): MaintenanceFormState {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  return { ...emptyForm, date_maintenance: localDate };
}

const maintenanceTypes = ["Vidange", "Assurance", "Contrôle technique", "Réparation", "Autre"];
const maintenanceStatuses = ["Planifiée", "En cours", "Terminée", "Annulée"];

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("fr-FR");
}

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${value.toFixed(0)} TND`;
}

function normalizeLabel(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isStatus(value: string | null | undefined, expected: string) {
  return normalizeLabel(value) === normalizeLabel(expected);
}

function isType(value: string | null | undefined, expected: string) {
  return normalizeLabel(value) === normalizeLabel(expected);
}

function getStatusStyle(status?: string | null) {
  if (isStatus(status, "Terminée")) {
    return "border-emerald-400/25 bg-emerald-500/10 text-emerald-300";
  }
  if (isStatus(status, "En cours")) {
    return "border-sky-400/25 bg-sky-500/10 text-sky-300";
  }
  if (isStatus(status, "Annulée")) {
    return "border-red-400/25 bg-red-500/10 text-red-300";
  }
  return "border-amber-400/25 bg-amber-500/10 text-amber-300";
}

function CompactFilterSelect({
  icon,
  label,
  value,
  onChange,
  children,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="relative min-w-[130px] flex-1">
      <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500">
        {icon}
      </span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-lg border border-white/10 bg-slate-950/50 pl-8 pr-2 text-xs font-medium text-slate-200 outline-none transition hover:border-white/20 hover:bg-slate-950/70 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-500/10"
      >
        {children}
      </select>
    </label>
  );
}

function getCarLabel(maintenance: Maintenance, cars: Car[]) {
  const car = cars.find((item) => item.id === maintenance.car_id) || maintenance.car;
  return car ? `${car.marque} ${car.modele}` : `Voiture #${maintenance.car_id}`;
}

export default function MaintenanceDashboard() {
  const router = useRouter();
  const [cars, setCars] = useState<Car[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewingMaintenance, setViewingMaintenance] = useState<Maintenance | null>(null);
  const [form, setForm] = useState<MaintenanceFormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [carFilter, setCarFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  async function loadData() {
    const token = authStorage.getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    setLoading(true);
    const [carsResult, maintenancesResult] = await Promise.all([
      carsAPI.getAll(),
      maintenanceAPI.getAll(),
    ]);

    if (carsResult.status === 401 || maintenancesResult.status === 401) {
      authStorage.clearToken();
      router.replace("/login");
      return;
    }

    if (!carsResult.success) {
      setError(carsResult.error || "Impossible de charger les voitures");
    }

    if (!maintenancesResult.success) {
      setError(maintenancesResult.error || "Impossible de charger les maintenances");
    }

    setCars(carsResult.data || []);
    setMaintenances(maintenancesResult.data || []);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (maintenances.length === 0 || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const requestedId = Number(url.searchParams.get("view"));
    if (!Number.isInteger(requestedId) || requestedId <= 0) return;
    const requestedMaintenance = maintenances.find((item) => item.id === requestedId);
    if (requestedMaintenance) setViewingMaintenance(requestedMaintenance);
    url.searchParams.delete("view");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [maintenances]);

  useEffect(() => {
    if (!showForm) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) resetForm();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [showForm, saving]);

  const filteredMaintenances = useMemo(() => {
    const searchValue = normalizeLabel(search);
    const now = new Date();

    return maintenances.filter((maintenance) => {
      const car = cars.find((item) => item.id === maintenance.car_id) || maintenance.car;
      const searchableContent = normalizeLabel(
        [
          car?.marque,
          car?.modele,
          car?.numImma,
          maintenance.type_maintenance,
          maintenance.description,
          maintenance.statut,
        ]
          .filter(Boolean)
          .join(" "),
      );
      const matchesSearch =
        !searchValue || searchableContent.includes(searchValue);

      const matchesStatus =
        statusFilter === "all" || isStatus(maintenance.statut, statusFilter);
      const matchesType =
        typeFilter === "all" || isType(maintenance.type_maintenance, typeFilter);
      const matchesCar =
        carFilter === "all" || maintenance.car_id === Number(carFilter);
      let matchesDate = true;
      if (dateFilter !== "all" && maintenance.date_maintenance) {
        const date = new Date(maintenance.date_maintenance);
        if (dateFilter === "month") {
          matchesDate =
            date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        } else if (dateFilter === "year") {
          matchesDate = date.getFullYear() === now.getFullYear();
        }
      }

      return matchesSearch && matchesStatus && matchesType && matchesDate && matchesCar;
    }).sort((a, b) => {
      if (sortOrder === "cost-asc") return (a.cout ?? 0) - (b.cout ?? 0);
      if (sortOrder === "cost-desc") return (b.cout ?? 0) - (a.cout ?? 0);
      const aDate = new Date(a.date_maintenance || a.created_at).getTime();
      const bDate = new Date(b.date_maintenance || b.created_at).getTime();
      return sortOrder === "oldest" ? aDate - bDate : bDate - aDate;
    });
  }, [cars, maintenances, search, statusFilter, typeFilter, dateFilter, carFilter, sortOrder]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, typeFilter, dateFilter, carFilter, sortOrder]);

  const stats = useMemo(() => {
    const now = new Date();
    const completed = maintenances.filter((item) => isStatus(item.statut, "Terminée")).length;
    const inProgress = maintenances.filter((item) => isStatus(item.statut, "En cours")).length;
    const late = maintenances.filter(
      (item) =>
        item.date_maintenance &&
        new Date(item.date_maintenance) < now &&
        !isStatus(item.statut, "Terminée") &&
        !isStatus(item.statut, "Annulée"),
    ).length;
    const activeVehicles = new Set(
      maintenances
        .filter((item) => isStatus(item.statut, "En cours"))
        .map((item) => item.car_id),
    ).size;
    const totalCost = maintenances.reduce((sum, item) => sum + (item.cout ?? 0), 0);
    const completionRate = maintenances.length
      ? Math.round((completed / maintenances.length) * 100)
      : 0;
    return [
      {
        label: "Total maintenances",
        value: maintenances.length,
        tone: "from-blue-600 to-blue-500",
        icon: "wrench" as const,
      },
      {
        label: "Véhicules en maintenance",
        value: activeVehicles,
        tone: "from-violet-600 to-fuchsia-500",
        icon: "car" as const,
      },
      {
        label: "Terminées",
        value: completed,
        tone: "from-emerald-600 to-teal-500",
        icon: "completed" as const,
      },
      {
        label: "En cours",
        value: inProgress,
        tone: "from-sky-600 to-cyan-500",
        icon: "progress" as const,
      },
      {
        label: "En retard",
        value: late,
        tone: "from-red-600 to-rose-500",
        icon: "late" as const,
      },
      {
        label: "Coût total",
        value: formatCurrency(totalCost),
        tone: "from-amber-600 to-orange-500",
        icon: "cost" as const,
      },
      {
        label: "Taux terminé",
        value: `${completionRate} %`,
        tone: "from-indigo-600 to-violet-500",
        icon: "completed" as const,
      },
    ];
  }, [maintenances]);

  const alerts = useMemo(() => {
    const items: { id: string | number; title: string; message: string; severity: "warning" | "danger" }[] = [];

    maintenances.forEach((maintenance) => {
      const carLabel = getCarLabel(maintenance, cars);

      if (
        isType(maintenance.type_maintenance, "Vidange") &&
        (isStatus(maintenance.statut, "Planifiée") ||
          isStatus(maintenance.statut, "En cours"))
      ) {
        const car = cars.find((item) => item.id === maintenance.car_id) || maintenance.car;
        const kmRemaining =
          maintenance.kilometrage && car?.kilometrage
            ? Math.max(0, maintenance.kilometrage - car.kilometrage)
            : null;

        items.push({
          id: `vidange-${maintenance.id}`,
          title: carLabel,
          message:
            kmRemaining !== null
              ? `Vidange nécessaire dans ${kmRemaining} km`
              : "Vidange planifiée prochainement",
          severity: "warning",
        });
      }

      if (isType(maintenance.type_maintenance, "Assurance")) {
        const isExpired =
          maintenance.date_maintenance &&
          new Date(maintenance.date_maintenance) < new Date() &&
          !isStatus(maintenance.statut, "Terminée");

        if (isExpired || isStatus(maintenance.statut, "Planifiée")) {
          items.push({
            id: `assurance-${maintenance.id}`,
            title: carLabel,
            message: isExpired ? "Assurance expirée" : "Renouvellement assurance à prévoir",
            severity: isExpired ? "danger" : "warning",
          });
        }
      }
    });

    return items.slice(0, 6);
  }, [cars, maintenances]);

  const historyItems = useMemo(() => {
    return maintenances
      .filter(
        (item) =>
          isStatus(item.statut, "Terminée") || isType(item.type_maintenance, "Réparation"),
      )
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        car: getCarLabel(item, cars),
        type: item.type_maintenance,
        date: formatDate(item.date_maintenance),
        cost: formatCurrency(item.cout),
        garage: item.description || "Non renseigné",
        status: isStatus(item.statut, "Terminée") ? "Terminé" : item.statut,
      }));
  }, [cars, maintenances]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const carId = Number(form.car_id);
    const cost = form.cout === "" ? undefined : Number(form.cout);
    const mileage = form.kilometrage === "" ? undefined : Number(form.kilometrage);
    const maintenanceDate = form.date_maintenance
      ? new Date(form.date_maintenance)
      : null;

    if (!Number.isInteger(carId) || carId <= 0) {
      setError("Veuillez sélectionner une voiture.");
      return;
    }
    if (maintenanceDate && Number.isNaN(maintenanceDate.getTime())) {
      setError("La date de maintenance est invalide.");
      return;
    }
    if (cost !== undefined && (!Number.isFinite(cost) || cost < 0)) {
      setError("Le coût doit être un nombre positif.");
      return;
    }
    if (mileage !== undefined && (!Number.isInteger(mileage) || mileage < 0)) {
      setError("Le kilométrage doit être un nombre entier positif.");
      return;
    }

    setSaving(true);
    const payload = {
      car_id: carId,
      type_maintenance: form.type_maintenance,
      description: form.description.trim() || undefined,
      date_maintenance: maintenanceDate?.toISOString(),
      cout: cost,
      kilometrage: mileage,
      statut: form.statut,
    };

    try {
      const result = editingId
        ? await maintenanceAPI.update(editingId, payload)
        : await maintenanceAPI.create(payload);

      if (!result.success) {
        setError(result.error || "Une erreur est survenue pendant l’enregistrement.");
        return;
      }

      setSuccess(editingId ? "Maintenance mise à jour avec succès." : "Maintenance ajoutée avec succès.");
      setForm(createMaintenanceForm());
      setEditingId(null);
      setShowForm(false);
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(maintenance: Maintenance) {
    setEditingId(maintenance.id);
    setShowForm(true);
    setForm({
      car_id: String(maintenance.car_id),
      type_maintenance: maintenance.type_maintenance,
      description: maintenance.description || "",
      date_maintenance: maintenance.date_maintenance ? maintenance.date_maintenance.slice(0, 16) : "",
      cout: maintenance.cout !== null && maintenance.cout !== undefined ? String(maintenance.cout) : "",
      kilometrage:
        maintenance.kilometrage !== null && maintenance.kilometrage !== undefined
          ? String(maintenance.kilometrage)
          : "",
      statut: maintenance.statut,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(maintenanceId: number) {
    const confirmed = window.confirm("Supprimer cette maintenance ?");
    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");
    const result = await maintenanceAPI.delete(maintenanceId);

    if (!result.success) {
      setError(result.error || "Suppression impossible");
      return;
    }

    setSuccess("Maintenance supprimée");
    await loadData();
  }

  async function handleMarkCompleted(maintenance: Maintenance) {
    if (isStatus(maintenance.statut, "Terminée")) return;

    setError("");
    setSuccess("");
    const result = await maintenanceAPI.update(maintenance.id, { statut: "Terminée" });
    if (!result.success) {
      setError(result.error || "Impossible de terminer cette maintenance.");
      return;
    }

    setSuccess("Maintenance marquée comme terminée.");
    await loadData();
  }

  function resetFilters() {
    setSearch("");
    setSearchDraft("");
    setStatusFilter("all");
    setTypeFilter("all");
    setDateFilter("all");
    setCarFilter("all");
    setSortOrder("newest");
  }

  async function exportPdf() {
    if (filteredMaintenances.length === 0 || exportingPdf) return;

    setExportingPdf(true);
    setError("");
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 12;
      const generatedAt = new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date());
      const totalCost = filteredMaintenances.reduce((sum, item) => sum + (item.cout ?? 0), 0);
      const completed = filteredMaintenances.filter((item) =>
        isStatus(item.statut, "Terminée"),
      ).length;
      const columns = [
        { label: "Véhicule", width: 48 },
        { label: "Immatriculation", width: 32 },
        { label: "Type", width: 43 },
        { label: "Date", width: 29 },
        { label: "Coût", width: 27 },
        { label: "Kilométrage", width: 31 },
        { label: "Statut", width: 33 },
      ];
      const rowHeight = 9;
      const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);

      const drawHeader = () => {
        doc.setFillColor(7, 17, 31);
        doc.rect(0, 0, pageWidth, 35, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("Rapport de maintenance", margin, 15);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(170, 190, 215);
        doc.text(`Généré le ${generatedAt}`, margin, 23);
        doc.text(`${filteredMaintenances.length} intervention(s) exportée(s)`, margin, 29);
      };

      const drawSummary = () => {
        const summaries = [
          ["Interventions", String(filteredMaintenances.length)],
          ["Terminées", String(completed)],
          ["Taux terminé", `${Math.round((completed / filteredMaintenances.length) * 100)} %`],
          ["Coût total", `${totalCost.toFixed(2)} TND`],
        ];
        const gap = 4;
        const cardWidth = (tableWidth - gap * 3) / 4;
        summaries.forEach(([label, value], index) => {
          const x = margin + index * (cardWidth + gap);
          doc.setFillColor(243, 246, 250);
          doc.roundedRect(x, 40, cardWidth, 18, 2, 2, "F");
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(90, 105, 125);
          doc.text(label, x + 4, 47);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          doc.setTextColor(20, 35, 55);
          doc.text(value, x + 4, 54);
        });
      };

      const drawTableHeader = (y: number) => {
        doc.setFillColor(29, 78, 216);
        doc.rect(margin, y, tableWidth, 9, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        let x = margin;
        columns.forEach((column) => {
          doc.text(column.label, x + 2.5, y + 5.8);
          x += column.width;
        });
      };

      drawHeader();
      drawSummary();
      let y = 64;
      drawTableHeader(y);
      y += 9;

      filteredMaintenances.forEach((item, rowIndex) => {
        if (y + rowHeight > pageHeight - 13) {
          doc.addPage();
          drawHeader();
          y = 42;
          drawTableHeader(y);
          y += 9;
        }

        const car = cars.find((entry) => entry.id === item.car_id) || item.car;
        const values = [
          car ? `${car.marque} ${car.modele}` : `Voiture #${item.car_id}`,
          car?.numImma || "-",
          item.type_maintenance,
          formatDate(item.date_maintenance),
          item.cout == null ? "-" : `${item.cout.toFixed(2)} TND`,
          item.kilometrage == null ? "-" : `${item.kilometrage} km`,
          item.statut,
        ];

        doc.setFillColor(...(rowIndex % 2 === 0 ? [250, 251, 253] : [241, 245, 249]) as [number, number, number]);
        doc.rect(margin, y, tableWidth, rowHeight, "F");
        doc.setDrawColor(222, 228, 236);
        doc.line(margin, y + rowHeight, margin + tableWidth, y + rowHeight);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(35, 48, 68);
        let x = margin;
        values.forEach((value, index) => {
          const maxWidth = columns[index].width - 5;
          const clipped = doc.splitTextToSize(String(value), maxWidth)[0] || "";
          doc.text(clipped, x + 2.5, y + 5.8);
          x += columns[index].width;
        });
        y += rowHeight;
      });

      const pageCount = doc.getNumberOfPages();
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        doc.setPage(pageNumber);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(120, 130, 145);
        doc.text(
          `Page ${pageNumber} / ${pageCount}`,
          pageWidth - margin,
          pageHeight - 6,
          { align: "right" },
        );
        doc.text("Gestion de location automobile - Maintenance", margin, pageHeight - 6);
      }

      doc.save(`fiche-maintenance-${new Date().toISOString().slice(0, 10)}.pdf`);
      setSuccess("La fiche PDF a été générée avec succès.");
    } catch {
      setError("Impossible de générer la fiche PDF.");
    } finally {
      setExportingPdf(false);
    }
  }

  function resetForm() {
    setForm(createMaintenanceForm());
    setEditingId(null);
    setError("");
    setSuccess("");
    setShowForm(false);
  }

  const carOptions = cars.length > 0 ? cars : (maintenances.map((item) => item.car).filter(Boolean) as Car[]);
  const totalPages = Math.max(1, Math.ceil(filteredMaintenances.length / pageSize));
  const paginatedMaintenances = filteredMaintenances.slice((page - 1) * pageSize, page * pageSize);
  const hasActiveFilters =
    search.trim() !== "" ||
    carFilter !== "all" ||
    statusFilter !== "all" ||
    typeFilter !== "all" ||
    dateFilter !== "all" ||
    sortOrder !== "newest";

  return (
    <div className="min-h-full space-y-5 bg-[#07111f] p-4 text-white md:p-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-gradient-to-r from-[#0b1628] to-[#101d33] p-5 shadow-2xl md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-white">
            <Wrench className="text-sky-400" size={26} />
            Gestion Maintenance
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Suivi des maintenances, alertes et statistiques du parc automobile.
          </p>
          <span className="mt-3 inline-flex rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-300">
            {maintenances.length} opération{maintenances.length === 1 ? "" : "s"} au total
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              setError("");
              setSuccess("");
              setForm(createMaintenanceForm());
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
          >
            <Plus size={16} />
            Ajouter une maintenance
          </button>
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={filteredMaintenances.length === 0 || exportingPdf}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {exportingPdf ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
            {exportingPdf ? "Génération..." : "Exporter PDF"}
          </button>
        </div>
      </div>

      {error && !showForm ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}
      {success && !showForm ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </div>
      ) : null}

      <MaintenanceStatsCards stats={stats} />

      {alerts.length > 0 ? <MaintenanceAlerts alerts={alerts} /> : null}

      {showForm ? (
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? "Modifier une maintenance" : "Ajouter une maintenance"}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) resetForm();
          }}
        >
          <form
            onSubmit={handleSubmit}
            className="mx-auto my-4 w-full max-w-4xl space-y-4 rounded-2xl border border-white/15 bg-[#0c1729] p-5 shadow-2xl shadow-black/50 sm:my-10 sm:p-6"
          >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">
                {editingId ? "Modifier une maintenance" : "Ajouter une maintenance"}
              </h2>
              <p className="text-sm text-slate-400">
                Sélectionnez une voiture existante et saisissez les détails.
              </p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              aria-label="Fermer le formulaire"
              className="rounded-lg border border-white/10 p-2 text-slate-300 transition hover:bg-white/5"
            >
              <X size={18} />
            </button>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {success}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-2 text-sm text-slate-200">
              <span>Voiture</span>
              <select
                value={form.car_id}
                onChange={(event) => setForm((current) => ({ ...current, car_id: event.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-500"
                required
              >
                <option value="">Sélectionner une voiture</option>
                {carOptions.map((car) => (
                  <option key={car.id} value={car.id}>
                    {car.marque} {car.modele} - {car.numImma}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-200">
              <span>Type maintenance</span>
              <select
                value={form.type_maintenance}
                onChange={(event) =>
                  setForm((current) => ({ ...current, type_maintenance: event.target.value }))
                }
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-500"
              >
                {maintenanceTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-200">
              <span>Statut</span>
              <select
                value={form.statut}
                onChange={(event) => setForm((current) => ({ ...current, statut: event.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-500"
              >
                {maintenanceStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-200 md:col-span-2 xl:col-span-3">
              <span>Description / Garage</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                rows={2}
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-200">
              <span>Date maintenance</span>
              <input
                type="datetime-local"
                value={form.date_maintenance}
                onChange={(event) =>
                  setForm((current) => ({ ...current, date_maintenance: event.target.value }))
                }
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-200">
              <span>Coût (TND)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.cout}
                onChange={(event) => setForm((current) => ({ ...current, cout: event.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-200">
              <span>Kilométrage</span>
              <input
                type="number"
                min="0"
                value={form.kilometrage}
                onChange={(event) =>
                  setForm((current) => ({ ...current, kilometrage: event.target.value }))
                }
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-3 font-semibold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
            {saving ? "Enregistrement..." : editingId ? "Mettre à jour" : "Ajouter maintenance"}
          </button>
          </form>
        </div>
      ) : null}

      {viewingMaintenance ? (
        <div
          className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setViewingMaintenance(null);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#0c1729] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-sky-400">Détails</p>
                <h2 className="mt-1 text-xl font-black text-white">
                  {getCarLabel(viewingMaintenance, cars)}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setViewingMaintenance(null)}
                className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10"
                aria-label="Fermer les détails"
              >
                <X size={18} />
              </button>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
              {[
                ["Type", viewingMaintenance.type_maintenance],
                ["Statut", viewingMaintenance.statut],
                ["Date", formatDate(viewingMaintenance.date_maintenance)],
                ["Coût", formatCurrency(viewingMaintenance.cout)],
                ["Kilométrage", viewingMaintenance.kilometrage ? `${viewingMaintenance.kilometrage} km` : "—"],
                ["Description / Garage", viewingMaintenance.description || "Non renseigné"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-white/[0.04] p-3">
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="mt-1 font-semibold text-slate-100">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : null}

      <MaintenanceCharts maintenances={maintenances} />

      <MaintenanceHistory items={historyItems} />

      <section className="space-y-2">
        <div className="rounded-xl border border-white/10 bg-[#0c1729] p-2.5 shadow-lg shadow-black/10">
          <form
            className="flex flex-wrap items-end gap-2 xl:flex-nowrap"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(searchDraft.trim());
            }}
          >
            <label className="relative min-w-[200px] flex-[1.5]">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
              <input
                type="search"
                aria-label="Recherche"
                value={searchDraft}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearchDraft(value);
                  setSearch(value);
                }}
                placeholder="Rechercher..."
                className="h-9 w-full rounded-lg border border-white/10 bg-slate-950/50 pl-8 pr-3 text-xs text-white outline-none transition placeholder:text-slate-500 hover:border-white/20 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-500/10"
              />
            </label>

            <CompactFilterSelect icon={<CarFront size={14} />} label="Véhicule" value={carFilter} onChange={setCarFilter}>
              <option value="all">Tous les véhicules</option>
              {carOptions.map((car) => <option key={car.id} value={car.id}>{car.marque} {car.modele} · {car.numImma}</option>)}
            </CompactFilterSelect>
            <CompactFilterSelect icon={<Check size={14} />} label="Statut" value={statusFilter} onChange={setStatusFilter}>
              <option value="all">Tous les statuts</option>
              {maintenanceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </CompactFilterSelect>
            <CompactFilterSelect icon={<Wrench size={14} />} label="Type" value={typeFilter} onChange={setTypeFilter}>
              <option value="all">Tous les types</option>
              {maintenanceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </CompactFilterSelect>
            <CompactFilterSelect icon={<CalendarDays size={14} />} label="Période" value={dateFilter} onChange={setDateFilter}>
              <option value="all">Toutes les périodes</option>
              <option value="month">Ce mois</option>
              <option value="year">Cette année</option>
            </CompactFilterSelect>
            <CompactFilterSelect icon={<SlidersHorizontal size={14} />} label="Trier par" value={sortOrder} onChange={setSortOrder}>
              <option value="newest">Plus récentes</option>
              <option value="oldest">Plus anciennes</option>
              <option value="cost-asc">Coût croissant</option>
              <option value="cost-desc">Coût décroissant</option>
            </CompactFilterSelect>

            <div className="ml-auto flex shrink-0 gap-2">
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-500 px-3 text-xs font-bold text-white transition hover:bg-sky-400 focus:ring-2 focus:ring-sky-500/30"
              >
                <Search size={14} />
                Rechercher
              </button>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus:ring-2 focus:ring-white/10"
                >
                  <RotateCcw size={14} />
                  Réinitialiser
                </button>
              ) : null}
            </div>
          </form>
        </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1729] shadow-xl">
        {loading ? (
          <div className="flex items-center justify-center gap-3 px-6 py-10 text-slate-300">
            <Loader2 className="animate-spin" size={18} />
            Chargement des maintenances...
          </div>
        ) : filteredMaintenances.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Wrench className="mx-auto text-slate-600" size={38} />
            <p className="mt-3 font-semibold text-slate-200">Aucune maintenance trouvée</p>
            <p className="mt-1 text-sm text-slate-500">Modifiez vos filtres ou ajoutez une intervention.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white/5 text-slate-300">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Voiture</th>
                  <th className="px-4 py-3 text-left font-semibold">Type</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Coût</th>
                  <th className="px-4 py-3 text-left font-semibold">Kilométrage</th>
                  <th className="px-4 py-3 text-left font-semibold">Statut</th>
                  <th className="px-4 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMaintenances.map((maintenance) => {
                  const car = cars.find((item) => item.id === maintenance.car_id) || maintenance.car;

                  return (
                    <tr key={maintenance.id} className="border-t border-white/5 transition hover:bg-white/5">
                      <td className="px-4 py-4">
                        <div className="font-medium text-white">
                          {car ? `${car.marque} ${car.modele}` : `Voiture #${maintenance.car_id}`}
                        </div>
                        <div className="text-xs text-slate-400">{car?.numImma || "-"}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-200">{maintenance.type_maintenance}</td>
                      <td className="px-4 py-4 text-slate-300">{formatDate(maintenance.date_maintenance)}</td>
                      <td className="px-4 py-4 text-slate-300">{formatCurrency(maintenance.cout)}</td>
                      <td className="px-4 py-4 text-slate-300">{maintenance.kilometrage ?? "-"}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusStyle(
                            maintenance.statut,
                          )}`}
                        >
                          {maintenance.statut}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setViewingMaintenance(maintenance)}
                            title="Voir les détails"
                            className="inline-flex items-center gap-1 rounded-lg border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-200 hover:bg-violet-500/20"
                          >
                            <Eye size={14} />
                            Voir
                          </button>
                          {!isStatus(maintenance.statut, "Terminée") ? (
                            <button
                              type="button"
                              onClick={() => void handleMarkCompleted(maintenance)}
                              title="Marquer comme terminée"
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20"
                            >
                              <Check size={14} />
                              Terminer
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleEdit(maintenance)}
                            className="inline-flex items-center gap-1 rounded-lg border border-sky-400/20 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-200 hover:bg-sky-500/20"
                          >
                            <Pencil size={14} />
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(maintenance.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 hover:bg-red-500/20"
                          >
                            <Trash2 size={14} />
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {filteredMaintenances.length} résultat{filteredMaintenances.length === 1 ? "" : "s"} · Page {page} sur {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-white/10 p-2 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Page précédente"
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-white/10 p-2 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Page suivante"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </section>
    </div>
  );
}
