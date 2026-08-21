type HistoryItem = {
  id: string | number;
  car: string;
  type: string;
  date: string;
  cost: string;
  garage: string;
  status: string;
};

export default function MaintenanceHistory({ items = [] }: { items?: HistoryItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0c1729] p-5 text-sm text-slate-400 shadow-xl">
        Aucune réparation terminée à afficher.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c1729] p-5 shadow-xl">
      <h2 className="mb-4 text-base font-bold text-white">Historique des réparations</h2>
      <ol className="relative ml-3 border-l-2 border-white/10">
        {items.map((item) => (
          <li key={item.id} className="relative mb-3 ml-5 last:mb-0">
            <span className="absolute -left-[26px] top-4 h-3 w-3 rounded-full border-2 border-emerald-400 bg-[#0c1729]" />
            <div className="rounded-xl border border-white/5 bg-white/[0.025] px-4 py-3 transition hover:bg-white/[0.045]">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold text-white">{item.car}</div>
                  <div className="mt-1 text-sm text-slate-400">Type : {item.type}</div>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
                  <span>{item.date}</span>
                  <span className="font-medium text-white">{item.cost}</span>
                  <span>{item.garage}</span>
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                    {item.status}
                  </span>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
