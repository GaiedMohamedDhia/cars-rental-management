"use client";
import { useState } from "react";
import jsPDF from "jspdf";

export type Payment = {
  id?: number;
  nom: string;
  cin: string;
  telephone: string;
  marque: string;
  modele: string;
  immatriculation: string;
  date_debut: string;
  date_fin: string;
  nombre_jours: number | string;
  prix_jour: number | string;
  method: string;
  status: string;
  amount: number | string;
  tva: number | string;
  total_ht: number | string;
  total_ttc: number | string;
};

const defaultForm: Payment = {
  nom: '',
  cin: '',
  telephone: '',
  marque: '',
  modele: '',
  immatriculation: '',
  date_debut: '',
  date_fin: '',
  nombre_jours: '',
  prix_jour: '',
  method: '',
  status: 'Payé',
  amount: '',
  tva: '',
  total_ht: '',
  total_ttc: ''
};

export default function PaymentForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Payment;
  onSubmit: (data: Payment) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Payment>(initial || defaultForm);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    // Validation simple
    if (!form.nom || !form.cin || !form.telephone) {
      setError('Veuillez remplir tous les champs obligatoires.');
      setIsSubmitting(false);
      return;
    }
    onSubmit(form);
    setIsSubmitting(false);
  }


  function handleDownloadPDF() {
    // Génération PDF simple avec jsPDF
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Facture de Paiement", 20, 20);
    doc.setFontSize(12);
    doc.text(`Nom: ${form.nom}`, 20, 35);
    doc.text(`CIN: ${form.cin}`, 20, 43);
    doc.text(`Téléphone: ${form.telephone}`, 20, 51);
    doc.text(`Voiture: ${form.marque} ${form.modele}`, 20, 59);
    doc.text(`Immatriculation: ${form.immatriculation}`, 20, 67);
    doc.text(`Période: ${form.date_debut} → ${form.date_fin}`, 20, 75);
    doc.text(`Nombre de jours: ${form.nombre_jours}`, 20, 83);
    doc.text(`Prix/Jour: ${form.prix_jour} DT`, 20, 91);
    doc.text(`Méthode: ${form.method}`, 20, 99);
    doc.text(`Statut: ${form.status}`, 20, 107);
    doc.text(`Montant: ${form.amount} DT`, 20, 115);
    doc.text(`TVA: ${form.tva}`, 20, 123);
    doc.text(`Total HT: ${form.total_ht}`, 20, 131);
    doc.text(`Total TTC: ${form.total_ttc}`, 20, 139);
    doc.save(`facture_paiement_${form.nom}.pdf`);
  }

  return (
    <div className="max-w-2xl mx-auto bg-white shadow-xl rounded-2xl p-8 border border-gray-100 mt-8">
      <form onSubmit={handleSubmit} className="space-y-7">
        <h2 className="text-3xl font-bold mb-2 text-gray-900 text-center">Ajouter un Paiement</h2>
        <p className="mb-6 text-gray-500 text-center">Ajoutez un nouveau paiement à la base de données</p>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg mb-2 justify-center">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0Z" /></svg>
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block mb-1 font-semibold text-gray-800">Nom <span className="text-red-500">*</span></label>
            <input name="nom" type="text" placeholder="Nom" value={form.nom} onChange={handleChange} className="w-full mb-4 p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-400 bg-white text-gray-900" required />
            <label className="block mb-1 font-semibold text-gray-800">CIN <span className="text-red-500">*</span></label>
            <input name="cin" type="text" placeholder="CIN" value={form.cin} onChange={handleChange} className="w-full mb-4 p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-400 bg-white text-gray-900" required />
            <label className="block mb-1 font-semibold text-gray-800">Téléphone <span className="text-red-500">*</span></label>
            <input name="telephone" type="text" placeholder="Téléphone" value={form.telephone} onChange={handleChange} className="w-full mb-4 p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-400 bg-white text-gray-900" required />
          </div>
          <div>
            <label className="block mb-1 font-semibold text-gray-800">Marque <span className="text-red-500">*</span></label>
            <input name="marque" type="text" placeholder="Marque" value={form.marque} onChange={handleChange} className="w-full mb-4 p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-400 bg-white text-gray-900" required />
            <label className="block mb-1 font-semibold text-gray-800">Modèle <span className="text-red-500">*</span></label>
            <input name="modele" type="text" placeholder="Modèle" value={form.modele} onChange={handleChange} className="w-full mb-4 p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-400 bg-white text-gray-900" required />
            <label className="block mb-1 font-semibold text-gray-800">Immatriculation <span className="text-red-500">*</span></label>
            <input name="immatriculation" type="text" placeholder="Immatriculation" value={form.immatriculation} onChange={handleChange} className="w-full mb-4 p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-400 bg-white text-gray-900" required />
          </div>
          <div>
            <label className="block mb-1 font-semibold text-gray-800">Date début <span className="text-red-500">*</span></label>
            <input name="date_debut" type="date" value={form.date_debut} onChange={handleChange} className="w-full mb-4 p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-400 bg-white text-gray-900" required />
            <label className="block mb-1 font-semibold text-gray-800">Date fin <span className="text-red-500">*</span></label>
            <input name="date_fin" type="date" value={form.date_fin} onChange={handleChange} className="w-full mb-4 p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-400 bg-white text-gray-900" required />
            <label className="block mb-1 font-semibold text-gray-800">Nombre jours <span className="text-red-500">*</span></label>
            <input name="nombre_jours" type="number" placeholder="Nombre jours" value={form.nombre_jours} onChange={handleChange} className="w-full mb-4 p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-400 bg-white text-gray-900" required />
            <label className="block mb-1 font-semibold text-gray-800">Prix/jour <span className="text-red-500">*</span></label>
            <input name="prix_jour" type="number" placeholder="Prix/jour" value={form.prix_jour} onChange={handleChange} className="w-full mb-4 p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-400 bg-white text-gray-900" required />
          </div>
          <div>
            <label className="block mb-1 font-semibold text-gray-800">Statut <span className="text-red-500">*</span></label>
            <select name="status" value={form.status} onChange={handleChange} className="w-full mb-4 p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-400 bg-white text-gray-900" required>
              <option value="Payé">Payé</option>
              <option value="Non payé">Non payé</option>
              <option value="Chèque">Chèque</option>
              <option value="Espèce">Espèce</option>
            </select>
            <label className="block mb-1 font-semibold text-gray-800">Méthode paiement <span className="text-red-500">*</span></label>
            <input name="method" type="text" placeholder="Méthode paiement" value={form.method} onChange={handleChange} className="w-full mb-4 p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-400 bg-white text-gray-900" required />
            <label className="block mb-1 font-semibold text-gray-800">Montant <span className="text-red-500">*</span></label>
            <input name="amount" type="number" placeholder="Montant" value={form.amount} onChange={handleChange} className="w-full mb-4 p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-400 bg-white text-gray-900" required />
            <label className="block mb-1 font-semibold text-gray-800">TVA</label>
            <input name="tva" type="number" placeholder="TVA" value={form.tva} onChange={handleChange} className="w-full mb-4 p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-400 bg-white text-gray-900" />
            <label className="block mb-1 font-semibold text-gray-800">Total HT</label>
            <input name="total_ht" type="number" placeholder="Total HT" value={form.total_ht} onChange={handleChange} className="w-full mb-4 p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-400 bg-white text-gray-900" />
            <label className="block mb-1 font-semibold text-gray-800">Total TTC</label>
            <input name="total_ttc" type="number" placeholder="Total TTC" value={form.total_ttc} onChange={handleChange} className="w-full mb-4 p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-400 bg-white text-gray-900" />
          </div>
        </div>

        <div className="flex gap-4 mt-8 justify-center">
          <button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-purple-600 to-purple-700 text-white py-3 px-8 rounded-xl text-lg font-semibold shadow hover:from-purple-700 hover:to-purple-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {isSubmitting ? (
              <span className="flex items-center gap-2 justify-center">
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                Ajout...
              </span>
            ) : 'Ajouter le Paiement'}
          </button>
          <button type="button" onClick={onCancel} className="bg-gray-100 text-gray-700 py-3 px-8 rounded-xl text-lg font-semibold shadow hover:bg-gray-200 transition-colors">
            Annuler
          </button>
          <button type="button" onClick={handleDownloadPDF} className="bg-purple-500 text-white py-3 px-8 rounded-xl text-lg font-semibold shadow hover:bg-purple-600 transition-colors">
            Télécharger
          </button>
        </div>
      </form>
    </div>
  );
}
