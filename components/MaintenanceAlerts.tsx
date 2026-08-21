import { AlertTriangle } from "lucide-react";

type MaintenanceAlert = {
  id: string | number;
  title: string;
  message: string;
  severity?: "warning" | "danger";
};

export default function MaintenanceAlerts({ alerts = [] }: { alerts?: MaintenanceAlert[] }) {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const isDanger = alert.severity === "danger";

        return (
          <div
            key={alert.id}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-sm ${
              isDanger
                ? "border-red-500/40 bg-gradient-to-r from-red-950/80 to-red-900/40"
                : "border-orange-500/40 bg-gradient-to-r from-orange-950/70 to-amber-900/30"
            }`}
          >
            <AlertTriangle
              size={20}
              className={isDanger ? "shrink-0 text-red-400" : "shrink-0 text-orange-400"}
            />
            <div className="min-w-0 sm:flex sm:items-center sm:gap-3">
              <div className="truncate text-sm font-bold text-white">{alert.title}</div>
              <div className="text-xs text-slate-300 sm:text-sm">{alert.message}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
