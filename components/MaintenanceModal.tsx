import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const types = ["Vidange", "Assurance", "Contrôle technique", "Réparation"];

export default function MaintenanceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    voiture: "",
    type: "Vidange",
    date: "",
    cout: "",
    km: "",
    prochaine: "",
    description: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: save
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.form
            onSubmit={handleSubmit}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-lg relative"
          >
            <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 dark:hover:text-white">
              <X size={22} />
            </button>
            <h2 className="text-xl font-bold mb-4">Ajouter une maintenance</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Voiture</label>
                <input name="voiture" value={form.voiture} onChange={handleChange} required className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type maintenance</label>
                <select name="type" value={form.type} onChange={handleChange} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900">
                  {types.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input name="date" type="date" value={form.date} onChange={handleChange} required className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Coût</label>
                <input name="cout" type="number" value={form.cout} onChange={handleChange} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Kilométrage</label>
                <input name="km" type="number" value={form.km} onChange={handleChange} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Prochaine maintenance</label>
                <input name="prochaine" type="date" value={form.prochaine} onChange={handleChange} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea name="description" value={form.description} onChange={handleChange} rows={2} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition">Annuler</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition">Enregistrer</button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
