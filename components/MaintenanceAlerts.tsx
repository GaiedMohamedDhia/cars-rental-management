import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import CarAvatar from "./CarAvatar";

const alerts = [
  {
    type: "urgent",
    icon: <AlertCircle className="text-white" size={20} />,
    title: "Toyota Yaris",
    message: "Vidange nécessaire dans 200 km",
    color: "bg-red-700 text-white border-red-800",
  },
  {
    type: "urgent",
    icon: <AlertCircle className="text-white" size={20} />,
    title: "Clio 4",
    message: "Assurance expirée",
    color: "bg-red-700 text-white border-red-800",
  },
  {
    type: "soon",
    icon: <AlertTriangle className="text-white" size={20} />,
    title: "Hyundai i20",
    message: "Contrôle technique expire bientôt",
    color: "bg-orange-600 text-white border-orange-700",
  },
];

export default function MaintenanceAlerts() {
  return (
    <div className="space-y-3">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 rounded-xl border-l-4 p-4 shadow-sm ${alert.color} animate-fadeIn`}
        >
          <CarAvatar alt={alert.title} />
          <div>
            <div className="font-semibold text-white">{alert.title}</div>
            <div className="text-sm text-white/90">{alert.message}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
