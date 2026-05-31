import { Wrench, Calendar, Euro, Building2, CheckCircle } from "lucide-react";
import CarAvatar from "./CarAvatar";

const repairs = [
  {
    car: "Toyota Yaris",
    type: "Freins",
    date: "2024-04-10",
    cost: 320,
    garage: "Garage Central",
    status: "Terminé",
  },
  {
    car: "Clio 4",
    type: "Pare-brise",
    date: "2024-03-22",
    cost: 180,
    garage: "AutoGlass+",
    status: "Terminé",
  },
  {
    car: "Hyundai i20",
    type: "Pneus",
    date: "2024-02-15",
    cost: 400,
    garage: "PneuPro",
    status: "Terminé",
  },
];

export default function MaintenanceHistory() {
  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Wrench size={22} className="text-blue-600" /> Historique Réparations</h2>
      <ol className="relative border-l-2 border-[var(--border)] ml-4">
        {repairs.map((r, i) => (
          <li key={i} className="mb-8 ml-6">
            <span className="absolute -left-4 flex items-center justify-center w-8 h-8 bg-[rgba(99,102,241,0.08)] rounded-full ring-2 ring-[var(--border)]">
              <CheckCircle className="text-green-400" size={16} />
            </span>
            <div className="flex flex-col md:flex-row md:items-center md:gap-6">
              <div className="flex items-center gap-3">
                <CarAvatar alt={r.car} />
                <div className="font-semibold text-white">{r.car}</div>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 text-sm">
                <Calendar size={16} /> {r.date}
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 text-sm">
                <Euro size={16} /> {r.cost} TND
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 text-sm">
                <Building2 size={16} /> {r.garage}
              </div>
              <span className="ml-auto px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold border border-green-300">{r.status}</span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Type : {r.type}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
