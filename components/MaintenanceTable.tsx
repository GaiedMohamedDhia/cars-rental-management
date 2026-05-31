import { motion } from "framer-motion";
import { Download, Eye, Edit, Trash2 } from "lucide-react";
import CarAvatar from "./CarAvatar";

const cars = [
  {
    image: "/car1.jpg",
    name: "Toyota Yaris",
    immat: "123 TU 4567",
    lastOil: "2025-04-01",
    nextOil: "2026-06-01",
    assurance: "2026-05-20",
    controle: "2026-07-01",
    status: "urgent",
  },
  {
    image: "/car2.jpg",
    name: "Clio 4",
    immat: "456 TU 1234",
    lastOil: "2025-03-10",
    nextOil: "2026-05-10",
    assurance: "2026-04-01",
    controle: "2026-08-01",
    status: "urgent",
  },
  {
    image: "/car3.jpg",
    name: "Hyundai i20",
    immat: "789 TU 5678",
    lastOil: "2026-04-15",
    nextOil: "2026-07-15",
    assurance: "2026-09-01",
    controle: "2026-06-10",
    status: "soon",
  },
  {
    image: "/car4.jpg",
    name: "Peugeot 208",
    immat: "321 TU 8765",
    lastOil: "2026-05-01",
    nextOil: "2026-08-01",
    assurance: "2026-12-01",
    controle: "2026-01-01",
    status: "ok",
  },
];

const statusMap = {
  ok: {
    label: "OK",
    color: "bg-green-100 text-green-700 border-green-300",
  },
  soon: {
    label: "Bientôt",
    color: "bg-orange-100 text-orange-700 border-orange-300",
  },
  urgent: {
    label: "Urgent",
    color: "bg-red-100 text-red-700 border-red-300",
  },
};

export default function MaintenanceTable() {
  return (
    <div className="rounded-2xl shadow-lg bg-[var(--card)] border border-[var(--border)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-[rgba(255,255,255,0.02)] sticky top-0">
              <th className="p-4 text-left font-semibold">Voiture</th>
              <th className="p-4 text-left font-semibold">Immatriculation</th>
              <th className="p-4 text-left font-semibold">Dernière vidange</th>
              <th className="p-4 text-left font-semibold">Prochaine vidange</th>
              <th className="p-4 text-left font-semibold">Assurance expire</th>
              <th className="p-4 text-left font-semibold">Contrôle technique</th>
              <th className="p-4 text-left font-semibold">Statut</th>
              <th className="p-4 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cars.map((car) => (
              <motion.tr
                key={car.immat}
                whileHover={{ scale: 1.01 }}
                className="transition-all border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)]"
              >
                <td className="p-4 flex items-center gap-3">
                  <CarAvatar src={car.image} alt={car.name} />
                  <div className="font-medium">{car.name}</div>
                </td>
                <td className="p-4">{car.immat}</td>
                <td className="p-4">{car.lastOil}</td>
                <td className="p-4">{car.nextOil}</td>
                <td className="p-4">{car.assurance}</td>
                <td className="p-4">{car.controle}</td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full border text-xs font-semibold ${statusMap[car.status as keyof typeof statusMap].color}`}>
                    {statusMap[car.status as keyof typeof statusMap].label}
                  </span>
                </td>
                <td className="p-4 flex gap-2">
                  <button className="p-2 rounded hover:bg-[rgba(99,102,241,0.06)]" title="Voir"><Eye size={18} /></button>
                  <button className="p-2 rounded hover:bg-[rgba(245,158,66,0.06)]" title="Éditer"><Edit size={18} /></button>
                  <button className="p-2 rounded hover:bg-[rgba(239,68,68,0.06)]" title="Supprimer"><Trash2 size={18} /></button>
                  <button className="p-2 rounded hover:bg-[rgba(16,185,129,0.06)]" title="Télécharger PDF"><Download size={18} /></button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
