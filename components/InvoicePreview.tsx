"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Mail, Printer, X } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import type { Payment, Rental } from "@/types";
import { resolveMediaUrl } from "@/lib/media-url";

type Props = {
  payment: Payment;
  rental?: Rental;
  payments: Payment[];
  onClose: () => void;
};

const company = {
  name: process.env.NEXT_PUBLIC_COMPANY_NAME || "TuniCars+",
  address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "",
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE || "",
  email: process.env.NEXT_PUBLIC_COMPANY_EMAIL || "",
  website: process.env.NEXT_PUBLIC_COMPANY_WEBSITE || "",
};

const money = (value?: number | null) =>
  value === null || value === undefined || !Number.isFinite(Number(value))
    ? "Non renseigné"
    : `${new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))} DT`;

const formatDateTime = (value?: string | null) => {
  if (!value) return "Non renseigné";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Non renseigné";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(parsed);
};

const formatDate = (value?: string | null) => {
  if (!value) return "Non renseigné";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Non renseigné"
    : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(parsed);
};

function Detail({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-[11px] font-semibold text-slate-800">{value || "Non renseigné"}</dd>
    </div>
  );
}

export default function InvoicePreview({ payment, rental, payments, onClose }: Props) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [qrCode, setQrCode] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const values = useMemo(() => {
    const start = rental?.dateDebut ? new Date(rental.dateDebut) : null;
    const plannedEndValue = rental?.dateFinPrevue || rental?.dateFin;
    const end = plannedEndValue ? new Date(plannedEndValue) : null;
    const duration =
      start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())
        ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000))
        : null;
    const unitPrice = rental?.car?.prixLocation;
    const calculatedTotal =
      duration && unitPrice !== null && unitPrice !== undefined
        ? duration * Number(unitPrice)
        : null;
    const totalDue =
      rental?.montantTotal !== null && rental?.montantTotal !== undefined
        ? Number(rental.montantTotal)
        : calculatedTotal;
    const amountPaid = payments
      .filter((item) => item.rental_id === payment.rental_id && item.status !== "Annulé")
      .reduce((sum, item) => sum + (Number.isFinite(Number(item.amount)) ? Number(item.amount) : 0), 0);
    const remaining = totalDue === null ? null : Math.max(0, totalDue - amountPaid);
    return { duration, unitPrice, totalDue, amountPaid, remaining };
  }, [payment, payments, rental]);

  useEffect(() => {
    const qrPayload = {
      facture: payment.invoice_number,
      client: rental?.renter ? `${rental.renter.prenom} ${rental.renter.nom}`.trim() : null,
      vehicule: rental?.car
        ? `${rental.car.marque} ${rental.car.modele} (${rental.car.numImma})`
        : null,
      montant: payment.amount,
      date: payment.payment_date,
    };
    QRCode.toDataURL(JSON.stringify(qrPayload), {
      width: 180,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    }).then(setQrCode).catch(() => setQrCode(""));
  }, [payment, rental]);

  async function createPdf() {
    if (!invoiceRef.current) throw new Error("Aperçu de facture indisponible");
    await document.fonts.ready;
    const canvas = await html2canvas(invoiceRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const scale = Math.min(210 / canvas.width, 297 / canvas.height);
    const width = canvas.width * scale;
    const height = canvas.height * scale;
    pdf.addImage(
      canvas.toDataURL("image/png", 1),
      "PNG",
      (210 - width) / 2,
      0,
      width,
      height,
      undefined,
      "FAST",
    );
    return pdf;
  }

  const download = async () => {
    setWorking(true); setError("");
    try {
      const pdf = await createPdf();
      pdf.save(`${payment.invoice_number}.pdf`);
    } catch {
      setError("Impossible de générer le PDF.");
    } finally {
      setWorking(false);
    }
  };

  const sendByEmail = async () => {
    setWorking(true); setError("");
    try {
      const pdf = await createPdf();
      const blob = pdf.output("blob");
      const file = new File([blob], `${payment.invoice_number}.pdf`, { type: "application/pdf" });
      const shareData = {
        title: `Facture ${payment.invoice_number}`,
        text: `Facture ${payment.invoice_number} — ${money(payment.amount)}`,
        files: [file],
      };
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        const recipient = rental?.renter?.email || "";
        window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(`Facture ${payment.invoice_number}`)}&body=${encodeURIComponent("Bonjour,\n\nVeuillez trouver votre facture de location. Le PDF a également été téléchargé afin que vous puissiez le joindre à ce message.\n\nMerci pour votre confiance.")}`;
        pdf.save(`${payment.invoice_number}.pdf`);
      }
    } catch (shareError) {
      if ((shareError as Error)?.name !== "AbortError") setError("Impossible de préparer l’envoi de la facture.");
    } finally {
      setWorking(false);
    }
  };

  if (!rental) {
    return (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-4">
        <div className="rounded-2xl bg-white p-6 text-slate-900">
          <p>Les informations de la location ne sont pas disponibles.</p>
          <button onClick={onClose} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-white">Fermer</button>
        </div>
      </div>
    );
  }

  const renterPhoto = resolveMediaUrl(rental.renter?.photoUrl);
  const carPhoto = resolveMediaUrl(rental.car?.photoUrl);
  const responsible = payment.creator
    ? `${payment.creator.prenom} ${payment.creator.nom}`.trim()
    : payment.created_by
      ? `Utilisateur #${payment.created_by}`
      : "Non renseigné";

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/85 p-3 backdrop-blur-sm sm:p-6">
      <div className="invoice-actions mx-auto mb-3 flex max-w-[794px] flex-wrap items-center justify-between gap-2">
        <button onClick={onClose} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-slate-900 px-3 text-sm font-semibold text-white"><X size={16} />Fermer</button>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-slate-900 px-3 text-sm font-semibold text-white"><Printer size={16} />Imprimer</button>
          <button onClick={sendByEmail} disabled={working} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-50"><Mail size={16} />Envoyer par e-mail</button>
          <button onClick={download} disabled={working} className="inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-500 px-3 text-sm font-bold text-slate-950 disabled:opacity-50"><Download size={16} />{working ? "Préparation…" : "Télécharger PDF"}</button>
        </div>
      </div>
      {error && <p className="invoice-actions mx-auto mb-3 max-w-[794px] rounded-xl bg-red-500 px-4 py-2 text-sm text-white">{error}</p>}

      <div ref={invoiceRef} id="invoice-document" className="invoice-document mx-auto flex min-h-[1123px] w-[794px] max-w-full flex-col overflow-hidden bg-white text-slate-800 shadow-2xl">
        <div className="h-2 bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600" />
        <div className="flex-1 p-10">
          <header className="flex items-start justify-between gap-8 border-b border-slate-200 pb-6">
            <div className="flex items-start gap-4">
              <img src="/logo.svg" alt={company.name} className="h-14 w-36 object-contain object-left" />
              <div className="text-[10px] leading-4 text-slate-500">
                <p className="text-sm font-black text-slate-900">{company.name}</p>
                {company.address && <p>{company.address}</p>}
                {company.phone && <p>{company.phone}</p>}
                {company.email && <p>{company.email}</p>}
                {company.website && <p>{company.website}</p>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[28px] font-black tracking-[0.16em] text-slate-900">FACTURE</p>
              <p className="mt-1 text-xs font-bold text-blue-600">{payment.invoice_number}</p>
              <p className="mt-2 text-[10px] text-slate-500">Émise le {formatDateTime(payment.payment_date)}</p>
              <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-[9px] font-bold uppercase ${payment.status === "Payé" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{payment.status}</span>
            </div>
          </header>

          <section className="mt-6 grid grid-cols-2 gap-5">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.15em] text-blue-600">Client</p>
              <div className="flex gap-3">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100 text-lg font-bold text-slate-500">
                  {renterPhoto ? <img src={renterPhoto} alt="" className="h-full w-full object-cover" /> : `${rental.renter?.prenom?.[0] || ""}${rental.renter?.nom?.[0] || ""}`}
                </div>
                <dl className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2">
                  <Detail label="Nom complet" value={`${rental.renter?.prenom || ""} ${rental.renter?.nom || ""}`.trim()} />
                  <Detail label="CIN" value={rental.renter?.cin} />
                  <Detail label="Téléphone" value={rental.renter?.telephone} />
                  <Detail label="E-mail" value={rental.renter?.email} />
                  <div className="col-span-2"><Detail label="Adresse" value={[rental.renter?.adresse, rental.renter?.ville].filter(Boolean).join(", ")} /></div>
                </dl>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.15em] text-violet-600">Véhicule</p>
              <div className="flex gap-3">
                <div className="grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100">
                  {carPhoto ? <img src={carPhoto} alt="" className="h-full w-full object-contain" /> : <span className="text-[9px] text-slate-400">Sans photo</span>}
                </div>
                <dl className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2">
                  <Detail label="Véhicule" value={`${rental.car?.marque || ""} ${rental.car?.modele || ""}`.trim()} />
                  <Detail label="Immatriculation" value={rental.car?.numImma} />
                  <Detail label="Année" value={rental.car?.annee} />
                  <Detail label="Kilométrage" value={rental.car?.kilometrage !== undefined ? `${new Intl.NumberFormat("fr-FR").format(rental.car.kilometrage)} km` : null} />
                  <div className="col-span-2"><Detail label="Prix par jour" value={money(rental.car?.prixLocation)} /></div>
                </dl>
              </div>
            </div>
          </section>

          <section className="mt-5 rounded-2xl bg-slate-50 p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Informations de la location</p>
            <dl className="grid grid-cols-4 gap-4">
              <Detail label="Location" value={`#${rental.id}`} />
              <Detail label="Date de début" value={formatDate(rental.dateDebut)} />
              <Detail label="Date de fin prévue" value={formatDate(rental.dateFinPrevue || rental.dateFin)} />
              <Detail label="Durée" value={values.duration ? `${values.duration} jour${values.duration === 1 ? "" : "s"}` : null} />
              <Detail label="Retour réel" value={formatDateTime(rental.dateRetourReelle)} />
              <div className="col-span-3"><Detail label="Responsable du paiement" value={responsible} /></div>
            </dl>
          </section>

          <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left text-[10px]">
              <thead className="bg-slate-900 text-white"><tr><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-center">Quantité</th><th className="px-4 py-3 text-right">Prix unitaire</th><th className="px-4 py-3 text-right">Total</th></tr></thead>
              <tbody><tr><td className="px-4 py-4 font-semibold">Location du véhicule {rental.car?.marque} {rental.car?.modele}</td><td className="px-4 py-4 text-center">{values.duration ? `${values.duration} jour(s)` : "—"}</td><td className="px-4 py-4 text-right">{money(values.unitPrice)}</td><td className="px-4 py-4 text-right font-bold">{money(values.totalDue)}</td></tr></tbody>
            </table>
          </section>

          <section className="mt-5 grid grid-cols-[1fr_250px] gap-6">
            <div className="flex items-start gap-4">
              {qrCode && <img src={qrCode} alt="QR Code de la facture" className="h-24 w-24" />}
              <dl className="grid gap-2 pt-1">
                <Detail label="Méthode de paiement" value={payment.method} />
                <Detail label="Date et heure du paiement" value={formatDateTime(payment.payment_date)} />
                <Detail label="Référence" value={payment.reference} />
              </dl>
            </div>
            <dl className="space-y-2 rounded-2xl bg-slate-50 p-4 text-[11px]">
              <div className="flex justify-between"><dt>Sous-total</dt><dd className="font-semibold">{money(values.totalDue)}</dd></div>
              <div className="flex justify-between text-slate-500"><dt>Remise</dt><dd>Non renseignée</dd></div>
              <div className="flex justify-between text-slate-500"><dt>TVA</dt><dd>Non renseignée</dd></div>
              <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-black"><dt>Total TTC</dt><dd>{money(values.totalDue)}</dd></div>
              <div className="flex justify-between text-emerald-700"><dt>Montant payé</dt><dd className="font-bold">{money(values.amountPaid)}</dd></div>
              <div className="flex justify-between text-rose-600"><dt>Reste à payer</dt><dd className="font-bold">{money(values.remaining)}</dd></div>
            </dl>
          </section>

          <section className="mt-8 grid grid-cols-2 gap-16 text-center text-[10px] text-slate-500">
            <div><div className="h-12 border-b border-slate-300" /><p className="mt-2">Signature du responsable</p><p className="font-semibold text-slate-800">{responsible}</p></div>
            <div><div className="h-12 border-b border-slate-300" /><p className="mt-2">Cachet de l’entreprise</p></div>
          </section>
        </div>
        <footer className="border-t border-slate-200 bg-slate-50 px-10 py-4 text-center text-[9px] text-slate-500">
          <p className="font-bold text-slate-700">Merci pour votre confiance.</p>
          {process.env.NEXT_PUBLIC_COMPANY_TERMS && <p className="mt-1">{process.env.NEXT_PUBLIC_COMPANY_TERMS}</p>}
          <p className="mt-1">{[company.address, company.phone, company.email, company.website].filter(Boolean).join(" · ")}</p>
        </footer>
      </div>
    </div>
  );
}
