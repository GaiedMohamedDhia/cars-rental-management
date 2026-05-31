"use client";

import { useState } from "react";
import MaintenanceStatsCards from "./MaintenanceStatsCards";
import MaintenanceTable from "./MaintenanceTable";
import MaintenanceAlerts from "./MaintenanceAlerts";
import MaintenanceHistory from "./MaintenanceHistory";
import MaintenanceModal from "./MaintenanceModal";
import MaintenanceFilters from "./MaintenanceFilters";
import MaintenanceCharts from "./MaintenanceCharts";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { motion } from "framer-motion";
import { Plus, CheckCircle } from "lucide-react";

export default function MaintenanceDashboard() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-2">
            <span className="text-blue-600 dark:text-blue-400"><span role="img" aria-label="maintenance">🔧</span></span>
            Gestion Maintenance
          </h1>
          <p className="text-gray-500 dark:text-gray-300 mt-1">
            Gérez les maintenances, assurances et réparations des véhicules
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg">
            <Plus size={20} />
            Ajouter Maintenance
          </Button>
          <Badge color="success" className="flex items-center gap-1 bg-green-100 text-green-700 border-green-300">
            <CheckCircle size={16} className="text-green-500" />
            Système Actif
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <MaintenanceStatsCards />

      {/* Filtres */}
      <MaintenanceFilters />

      {/* Alertes */}
      <MaintenanceAlerts />

      {/* Tableau principal */}
      <MaintenanceTable />

      {/* Charts */}
      <MaintenanceCharts />

      {/* Historique Réparations */}
      <MaintenanceHistory />

      {/* Modal Ajout Maintenance */}
      <MaintenanceModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
