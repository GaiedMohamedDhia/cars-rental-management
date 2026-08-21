"use client";

import { useSyncExternalStore, type ReactElement } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Maintenance } from "@/types";

const CHART_HEIGHT = 210;
const COLORS = ["#3B82F6", "#F97316", "#EF4444", "#10B981", "#8B5CF6", "#EC4899"];

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

function ClientChart({ chart }: { chart: ReactElement }) {
  const ready = useIsClient();

  if (!ready) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-lg bg-white/5 text-sm text-slate-400"
        style={{ height: CHART_HEIGHT }}
      >
        Chargement du graphique…
      </div>
    );
  }

  return (
    <div className="w-full min-w-0" style={{ height: CHART_HEIGHT }}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        {chart}
      </ResponsiveContainer>
    </div>
  );
}

function getCarLabel(maintenance: Maintenance) {
  const car = maintenance.car;
  return car
    ? `${car.marque} ${car.modele}${car.numImma ? ` · ${car.numImma}` : ""}`
    : `Voiture #${maintenance.car_id}`;
}

function normalizeLabel(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export default function MaintenanceCharts({ maintenances = [] }: { maintenances?: Maintenance[] }) {
  const monthlyData = maintenances.reduce(
    (acc, item) => {
      if (!item.date_maintenance || item.cout == null) {
        return acc;
      }

      const date = new Date(item.date_maintenance);
      if (Number.isNaN(date.getTime())) {
        return acc;
      }

      const monthKey = date.toLocaleString("fr-FR", { month: "short" });
      if (!acc[monthKey]) {
        acc[monthKey] = { month: monthKey, cost: 0 };
      }
      acc[monthKey].cost += item.cout;
      return acc;
    },
    {} as Record<string, { month: string; cost: number }>
  );

  const monthOrder = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const barData =
    Object.values(monthlyData).length > 0
      ? Object.values(monthlyData).sort(
          (a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month)
        )
      : [
          { month: "Jan", cost: 0 },
          { month: "Fév", cost: 0 },
          { month: "Mar", cost: 0 },
          { month: "Avr", cost: 0 },
          { month: "Mai", cost: 0 },
          { month: "Juin", cost: 0 },
        ];

  // Count every maintenance intervention. The previous implementation only
  // counted repairs or completed records, leaving this chart empty after most additions.
  const maintenanceByCar = maintenances.reduce(
    (acc, item) => {
      const key = String(item.car_id);
      const current = acc.get(key);
      acc.set(key, {
        name: getCarLabel(item),
        value: (current?.value || 0) + 1,
      });
      return acc;
    },
    new Map<string, { name: string; value: number }>(),
  );

  const pieData = Array.from(maintenanceByCar.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const statusData = Array.from(
    maintenances.reduce((acc, item) => {
      const label = item.statut || "Non renseigné";
      const key = normalizeLabel(label);
      const current = acc.get(key);
      acc.set(key, { name: current?.name || label, value: (current?.value || 0) + 1 });
      return acc;
    }, new Map<string, { name: string; value: number }>()),
  ).map(([, value]) => value);

  const costByType = Array.from(
    maintenances.reduce((acc, item) => {
      const label = item.type_maintenance || "Autre";
      const current = acc.get(label) || 0;
      acc.set(label, current + (item.cout ?? 0));
      return acc;
    }, new Map<string, number>()),
  )
    .map(([type, cost]) => ({ type, cost }))
    .sort((a, b) => b.cost - a.cost);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-[#0c1729] p-5 shadow-xl shadow-black/10">
        <h3 className="mb-3 text-sm font-bold text-white">Coûts de maintenance par mois</h3>
        <ClientChart
          chart={
            <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} width={48} />
              <Tooltip
                formatter={(value: number) => [`${Number(value).toFixed(0)} TND`, "Coût"]}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "#0f172a",
                  color: "#fff",
                }}
              />
              <Bar dataKey="cost" fill="#3B82F6" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          }
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0c1729] p-5 shadow-xl shadow-black/10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-white">Voitures les plus entretenues</h3>
          <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-300">
            {maintenances.length} intervention{maintenances.length === 1 ? "" : "s"}
          </span>
        </div>
        {pieData.length === 0 ? (
          <div
            className="flex items-center justify-center rounded-lg bg-white/5 text-sm text-slate-400"
            style={{ height: CHART_HEIGHT }}
          >
            Aucune maintenance enregistrée
          </div>
        ) : (
          <>
            <ClientChart
              chart={
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value} intervention(s)`, name]}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "#0f172a",
                      color: "#fff",
                    }}
                  />
                </PieChart>
              }
            />
            <div className="mt-4 flex flex-wrap justify-center gap-4">
              {pieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2 text-sm text-slate-300">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span>
                    {entry.name} ({entry.value})
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0c1729] p-5 shadow-xl shadow-black/10">
        <h3 className="mb-3 text-sm font-bold text-white">Répartition par statut</h3>
        {statusData.length === 0 ? (
          <div className="flex h-[210px] items-center justify-center rounded-lg bg-white/5 text-sm text-slate-400">
            Aucune donnée disponible
          </div>
        ) : (
          <>
            <ClientChart
              chart={
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value} maintenance(s)`, name]}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "#0f172a",
                      color: "#fff",
                    }}
                  />
                </PieChart>
              }
            />
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              {statusData.map((entry, index) => (
                <span key={entry.name} className="flex items-center gap-1.5 text-xs text-slate-300">
                  <i className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
                  {entry.name} ({entry.value})
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0c1729] p-5 shadow-xl shadow-black/10">
        <h3 className="mb-3 text-sm font-bold text-white">Coûts par type de maintenance</h3>
        <ClientChart
          chart={
            <BarChart data={costByType} layout="vertical" margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis type="category" dataKey="type" tick={{ fontSize: 11, fill: "#94a3b8" }} width={90} />
              <Tooltip
                formatter={(value: number) => [`${Number(value).toFixed(0)} TND`, "Coût"]}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "#0f172a",
                  color: "#fff",
                }}
              />
              <Bar dataKey="cost" fill="#8B5CF6" radius={[0, 6, 6, 0]} maxBarSize={24} />
            </BarChart>
          }
        />
      </div>
    </div>
  );
}
