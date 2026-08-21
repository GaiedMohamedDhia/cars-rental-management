type MaintenanceTableRow = {
  id: number
  carLabel: string
  carImmat?: string
  date: string
  status: string
}

export default function MaintenanceTable({ rows = [] }: { rows?: MaintenanceTableRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--muted)]">
        Aucune donnée de maintenance à afficher.
      </div>
    )
  }

  return (
    <div className="rounded-2xl shadow-lg bg-[var(--card)] border border-[var(--border)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-[rgba(255,255,255,0.02)] sticky top-0">
              <th className="p-4 text-left font-semibold">Voiture</th>
              <th className="p-4 text-left font-semibold">Immatriculation</th>
              <th className="p-4 text-left font-semibold">Date</th>
              <th className="p-4 text-left font-semibold">Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="transition-all border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)]">
                <td className="p-4 font-medium">{row.carLabel}</td>
                <td className="p-4">{row.carImmat || "-"}</td>
                <td className="p-4">{row.date}</td>
                <td className="p-4">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
