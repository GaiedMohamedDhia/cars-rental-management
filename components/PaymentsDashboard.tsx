"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, Download, Eye, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { paymentsAPI, rentalsAPI } from "@/lib/api-client";
import InvoicePreview from "@/components/InvoicePreview";
import type { Payment, Rental, UpdatePaymentInput } from "@/types";

const methods = ["Espèces", "Carte bancaire", "Virement bancaire", "Chèque"] as const;
const statuses = ["Payé", "En attente", "Partiellement payé", "Annulé"] as const;
const input =
  "h-10 rounded-lg border border-slate-700 bg-slate-950/60 px-3 text-sm text-white outline-none focus:border-cyan-500";
const formatDate = (value?: string | null) =>
  value && !Number.isNaN(new Date(value).getTime())
    ? new Intl.DateTimeFormat("fr-FR").format(new Date(value))
    : "—";

export default function PaymentsDashboard() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [selected, setSelected] = useState<Payment | null>(null);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [workingId, setWorkingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const [paymentResult, rentalResult] = await Promise.all([
      paymentsAPI.getAll(),
      rentalsAPI.getAll(),
    ]);
    setPayments(paymentResult.data || []);
    setRentals(rentalResult.data || []);
    setError(paymentResult.success ? "" : paymentResult.error || "Chargement impossible");
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const rentalMap = useMemo(
    () => new Map(rentals.map((rental) => [rental.id, rental])),
    [rentals],
  );
  const rows = payments.filter((payment) => {
    const rental = rentalMap.get(payment.rental_id);
    const text = `${payment.invoice_number} ${rental?.renter?.nom || ""} ${
      rental?.renter?.prenom || ""
    } ${rental?.car?.marque || ""} ${rental?.car?.modele || ""}`.toLowerCase();
    return (
      (!search || text.includes(search.toLowerCase())) &&
      (statusFilter === "all" || payment.status === statusFilter) &&
      (methodFilter === "all" || payment.method === methodFilter)
    );
  });

  const viewPayment = async (id: number) => {
    if (workingId !== null) return;
    setWorkingId(id);
    setError("");
    const result = await paymentsAPI.getById(id);
    setWorkingId(null);
    if (result.success && result.data) setSelected(result.data);
    else setError(result.error || "Paiement introuvable");
  };

  const deletePayment = async (payment: Payment) => {
    if (
      workingId !== null ||
      !window.confirm(
        `Supprimer définitivement le paiement ${payment.invoice_number || `#${payment.id}`} ?`,
      )
    )
      return;
    setWorkingId(payment.id);
    setError("");
    const result = await paymentsAPI.delete(payment.id);
    setWorkingId(null);
    if (result.success) {
      setPayments((items) => items.filter((item) => item.id !== payment.id));
      if (selected?.id === payment.id) setSelected(null);
      if (editing?.id === payment.id) setEditing(null);
      setToast(result.data?.message || "Paiement supprimé définitivement");
    } else {
      setError(result.error || "Suppression du paiement impossible");
    }
  };

  return (
    <main className="min-h-full flex-1 bg-[var(--bg)] p-4 sm:p-6 lg:p-8">
      {toast && (
        <div className="fixed right-5 top-5 z-50 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-xl">
          {toast}
        </div>
      )}
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">Finance</p>
            <h1 className="mt-1 text-3xl font-black text-white">Paiements</h1>
            <p className="text-sm text-slate-400">Encaissements et factures des locations.</p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-cyan-500 px-4 text-sm font-bold text-slate-950"
          >
            <Plus size={17} /> Encaisser
          </button>
        </header>

        <div className="mb-4 grid gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-3 md:grid-cols-[2fr_1fr_1fr]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Facture, client, véhicule…"
              className={`${input} w-full pl-9`}
            />
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={input}>
            <option value="all">Tous les statuts</option>
            {statuses.map((status) => <option key={status}>{status}</option>)}
          </select>
          <select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)} className={input}>
            <option value="all">Toutes les méthodes</option>
            {methods.map((method) => <option key={method}>{method}</option>)}
          </select>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300">
            {error}
          </div>
        )}
        {loading ? (
          <div className="h-64 animate-pulse rounded-2xl bg-slate-900" />
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 py-16 text-center text-slate-400">
            <Banknote className="mx-auto mb-3" size={38} />
            Aucun paiement enregistré.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-950/60 text-left text-xs uppercase text-slate-500">
                <tr>
                  {["Facture", "Client", "Véhicule", "Location", "Montant", "Méthode", "Statut", "Actions"].map((heading) => (
                    <th key={heading} className="px-4 py-3">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((payment) => {
                  const rental = rentalMap.get(payment.rental_id);
                  const busy = workingId === payment.id;
                  const cancelled = payment.status === "Annulé";
                  return (
                    <tr key={payment.id} className="border-t border-slate-800 text-slate-300 hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-bold text-cyan-400">{payment.invoice_number || `#${payment.id}`}</td>
                      <td className="px-4 py-3">{rental?.renter?.prenom} {rental?.renter?.nom}</td>
                      <td className="px-4 py-3">{rental?.car?.marque} {rental?.car?.modele}</td>
                      <td className="px-4 py-3">{formatDate(rental?.dateDebut)}</td>
                      <td className="px-4 py-3 font-bold">{payment.amount.toFixed(2)} DT</td>
                      <td className="px-4 py-3">{payment.method}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${cancelled ? "bg-slate-700 text-slate-300" : payment.status === "Payé" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-300"}`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <ActionButton title="Voir" disabled={busy} onClick={() => void viewPayment(payment.id)}><Eye size={14} /></ActionButton>
                          <ActionButton title="Modifier" disabled={busy || cancelled} onClick={() => setEditing(payment)}><Pencil size={14} /></ActionButton>
                          <ActionButton title="Voir la facture" disabled={busy} onClick={() => void viewPayment(payment.id)}><Download size={14} /></ActionButton>
                          <ActionButton title="Supprimer définitivement" danger disabled={busy} onClick={() => void deletePayment(payment)}><Trash2 size={14} /></ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen && (
        <PaymentForm
          rentals={rentals}
          onClose={() => setCreateOpen(false)}
          onSaved={(payment) => {
            setPayments((items) => [payment, ...items]);
            setCreateOpen(false);
            setToast("Paiement enregistré et facture générée");
          }}
        />
      )}
      {editing && (
        <PaymentForm
          payment={editing}
          rentals={rentals}
          onClose={() => setEditing(null)}
          onSaved={(payment) => {
            setPayments((items) => items.map((item) => item.id === payment.id ? payment : item));
            setEditing(null);
            setToast("Paiement modifié");
          }}
        />
      )}
      {selected && (
        <InvoicePreview
          payment={selected}
          rental={rentalMap.get(selected.rental_id)}
          payments={payments}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  );
}

function ActionButton({ children, title, disabled, danger, onClick }: {
  children: React.ReactNode;
  title: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`action-button disabled:cursor-not-allowed disabled:opacity-40 ${danger ? "text-red-400" : ""}`}
    >
      {children}
    </button>
  );
}

function PaymentForm({ rentals, payment, onClose, onSaved }: {
  rentals: Rental[];
  payment?: Payment;
  onClose: () => void;
  onSaved: (payment: Payment) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const date = payment ? new Date(payment.payment_date) : new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    const values = new FormData(event.currentTarget);
    const amount = Number(values.get("amount"));
    const paymentDate = new Date(String(values.get("payment_date") || ""));
    if (!Number.isFinite(amount) || amount <= 0 || Number.isNaN(paymentDate.getTime())) {
      setError("Vérifiez le montant et la date du paiement.");
      setSaving(false);
      return;
    }
    const common = {
      amount,
      method: String(values.get("method")) as UpdatePaymentInput["method"],
      payment_date: paymentDate.toISOString(),
      reference: String(values.get("reference") || "") || null,
      notes: String(values.get("notes") || "") || null,
    };
    const result = payment
      ? await paymentsAPI.update(payment.id, {
          ...common,
          status: String(values.get("status")) as UpdatePaymentInput["status"],
        })
      : await paymentsAPI.create({
          ...common,
          reference: common.reference || undefined,
          notes: common.notes || undefined,
          rental_id: Number(values.get("rental_id")),
          method: common.method!,
        });
    if (result.success && result.data) onSaved(result.data);
    else {
      setError(result.error || "Enregistrement impossible");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-4 flex justify-between">
          <div>
            <h2 className="text-xl font-black text-white">{payment ? "Modifier le paiement" : "Encaisser un paiement"}</h2>
            {payment && <p className="text-xs text-slate-400">{payment.invoice_number}</p>}
          </div>
          <button disabled={saving} type="button" onClick={onClose} aria-label="Fermer"><X /></button>
        </div>
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {!payment && (
            <select required name="rental_id" className={`${input} sm:col-span-2`}>
              <option value="">Sélectionner une location</option>
              {rentals.map((rental) => (
                <option key={rental.id} value={rental.id}>#{rental.id} · {rental.renter?.prenom} {rental.renter?.nom} · {rental.car?.marque} {rental.car?.modele}</option>
              ))}
            </select>
          )}
          <input required name="amount" min=".01" step=".01" type="number" defaultValue={payment?.amount} placeholder="Montant" className={input} />
          <select required name="method" defaultValue={payment?.method || ""} className={input}>
            <option value="">Méthode</option>
            {methods.map((method) => <option key={method}>{method}</option>)}
          </select>
          {payment && (
            <select required name="status" defaultValue={payment.status} className={input}>
              {statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          )}
          <input required name="payment_date" type="datetime-local" defaultValue={date.toISOString().slice(0, 16)} className={input} />
          <input name="reference" defaultValue={payment?.reference || ""} placeholder="Référence (optionnelle)" className={input} />
          <textarea name="notes" defaultValue={payment?.notes || ""} placeholder="Remarques" className="min-h-20 rounded-lg border border-slate-700 bg-slate-950/60 p-3 text-sm text-white sm:col-span-2" />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button disabled={saving} type="button" onClick={onClose} className="action-button">Fermer</button>
          <button disabled={saving} className="h-10 rounded-lg bg-cyan-500 px-4 text-sm font-bold text-slate-950 disabled:opacity-50">
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
