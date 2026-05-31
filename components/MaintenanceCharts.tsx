import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";

const maintenanceCosts = [
  { month: "Jan", cost: 1200 },
  { month: "Fév", cost: 900 },
  { month: "Mar", cost: 1500 },
  { month: "Avr", cost: 800 },
  { month: "Mai", cost: 1700 },
  { month: "Juin", cost: 1100 },
];

const mostRepaired = [
  { name: "Toyota Yaris", value: 8 },
  { name: "Clio 4", value: 5 },
  { name: "Hyundai i20", value: 3 },
  { name: "Peugeot 208", value: 2 },
];

const COLORS = ["#6366f1", "#f59e42", "#ef4444", "#10b981"];

export default function MaintenanceCharts() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
      <div className="bg-[var(--card)] rounded-2xl shadow-lg p-6 border border-[var(--border)]">
        <h3 className="font-semibold mb-4 text-white">Coûts maintenance par mois</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={maintenanceCosts}>
            <XAxis dataKey="month" stroke="#888" />
            <YAxis stroke="#888" />
            <Tooltip />
            <Bar dataKey="cost" fill="#6366f1" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-[var(--card)] rounded-2xl shadow-lg p-6 border border-[var(--border)]">
        <h3 className="font-semibold mb-4 text-white">Voitures les plus réparées</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={mostRepaired} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
              {mostRepaired.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Legend />
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
