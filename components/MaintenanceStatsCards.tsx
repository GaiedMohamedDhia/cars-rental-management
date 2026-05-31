import { motion } from "framer-motion";
import { Wrench, Droplet, FileText, Car } from "lucide-react";

const stats = [
  {
    label: "Maintenances Totales",
    value: 3,
    icon: <Wrench className="text-blue-600" size={28} />,
    bg: "bg-white dark:bg-gray-900",
    border: "border-blue-100 dark:border-blue-800",
    hover: "hover:shadow-blue-200 hover:-translate-y-1",
  },
  {
    label: "Vidanges Proches",
    value: 5,
    icon: <Droplet className="text-yellow-500" size={28} />,
    bg: "bg-white dark:bg-gray-900",
    border: "border-yellow-100 dark:border-yellow-800",
    hover: "hover:shadow-yellow-200 hover:-translate-y-1",
  },
  {
    label: "Assurances Expirées",
    value: 2,
    icon: <FileText className="text-red-500" size={28} />,
    bg: "bg-red-50 dark:bg-red-900",
    border: "border-red-200 dark:border-red-800",
    hover: "hover:shadow-red-200 hover:-translate-y-1",
  },
  {
    label: "Contrôles Techniques",
    value: 3,
    icon: <Car className="text-purple-600" size={28} />,
    bg: "bg-white dark:bg-gray-900",
    border: "border-purple-100 dark:border-purple-800",
    hover: "hover:shadow-purple-200 hover:-translate-y-1",
  },
];

export default function MaintenanceStatsCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => (
        <motion.div
          key={stat.label}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.98 }}
          className={`rounded-2xl border ${stat.bg} ${stat.border} p-6 shadow-md transition-all duration-200 ${stat.hover} cursor-pointer flex items-center gap-4`}
        >
          <div className="flex-shrink-0">{stat.icon}</div>
          <div>
            <div className="text-2xl font-bold mb-1">{stat.value}</div>
            <div className="text-gray-600 dark:text-gray-300 text-sm font-medium">{stat.label}</div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
