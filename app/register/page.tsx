"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [form, setForm] = useState({
    username: '',
    password: '',
    nom: '',
    cin: '',
    telephone: ''
  });
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        setError('Erreur lors de l’inscription');
        return;
      }
      router.push('/login');
    } catch {
      setError('Erreur de connexion');
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <form onSubmit={handleRegister} className="bg-white p-8 rounded shadow-md w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-6 text-center">Créer un compte</h2>
        <input
          type="text"
          placeholder="Nom d'utilisateur"
          value={form.username}
          onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
          className="w-full mb-4 p-2 border rounded"
          required
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={form.password}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          className="w-full mb-4 p-2 border rounded"
          required
        />
        <input
          type="text"
          placeholder="Nom"
          value={form.nom}
          onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
          className="w-full mb-4 p-2 border rounded"
        />
        <input
          type="text"
          placeholder="CIN"
          value={form.cin}
          onChange={e => setForm(f => ({ ...f, cin: e.target.value }))}
          className="w-full mb-4 p-2 border rounded"
        />
        <input
          type="text"
          placeholder="Téléphone"
          value={form.telephone}
          onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))}
          className="w-full mb-4 p-2 border rounded"
        />
        {error && <div className="text-red-500 mb-4 text-center">{error}</div>}
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">S&apos;inscrire</button>
        <div className="mt-4 text-center">
          <a href="/login" className="text-blue-600 hover:underline">Déjà un compte ? Se connecter</a>
        </div>
      </form>
    </div>
  );
}
