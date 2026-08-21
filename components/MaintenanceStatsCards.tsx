import {
  AlertTriangle,
  Car,
  CircleDollarSign,
  CircleCheck,
  Clock3,
  Droplet,
  FileWarning,
  Wrench,
} from "lucide-react";

type StatCard = {
  label: string;
  value: string | number;
  tone: string;
  icon:
    | "wrench"
    | "droplet"
    | "insurance"
    | "car"
    | "completed"
    | "progress"
    | "late"
    | "cost";
};

const iconMap = {
  wrench: Wrench,
  droplet: Droplet,
  insurance: FileWarning,
  car: Car,
  completed: CircleCheck,
  progress: Clock3,
  late: AlertTriangle,
  cost: CircleDollarSign,
};

export default function MaintenanceStatsCards({ stats = [] }: { stats?: StatCard[] }) {
  if (stats.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
      {stats.map((stat) => {
        const Icon = iconMap[stat.icon];

        return (
          <div
            key={stat.label}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0c1729] p-4 text-white shadow-lg shadow-black/10 transition duration-300 hover:-translate-y-0.5 hover:border-white/20"
          >
            <div className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${stat.tone}`} />
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-2xl font-black tracking-tight">{stat.value}</div>
                <div className="mt-1 text-xs font-semibold leading-tight text-slate-400 sm:text-sm">
                  {stat.label}
                </div>
              </div>
              <div className={`rounded-xl bg-gradient-to-br ${stat.tone} p-2.5 shadow-lg`}>
                <Icon size={20} className="text-white" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
