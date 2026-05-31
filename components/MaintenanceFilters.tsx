import { Search, Filter } from "lucide-react";

export default function MaintenanceFilters() {
  return (
    <div className="flex flex-col md:flex-row gap-3 items-center mb-4">
      <div className="relative w-full md:w-64">
        <input
          type="text"
          placeholder="Rechercher une voiture..."
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
      </div>
      <div className="flex gap-2">
        <select className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none">
          <option>Statut</option>
          <option>OK</option>
          <option>Bientôt</option>
          <option>Urgent</option>
        </select>
        <select className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none">
          <option>Date</option>
          <option>Ce mois</option>
          <option>Prochain mois</option>
        </select>
        <select className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none">
          <option>Type maintenance</option>
          <option>Vidange</option>
          <option>Assurance</option>
          <option>Contrôle technique</option>
          <option>Réparation</option>
        </select>
        <button className="flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-800 transition">
          <Filter size={16} />
          Filtres
        </button>
      </div>
    </div>
  );
}
