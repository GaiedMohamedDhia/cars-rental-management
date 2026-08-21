"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";
import { carsAPI } from "@/lib/api-client";

export function DeleteCarButton({
  carId,
  carName,
  compact = false,
  onDeleted,
}: {
  carId: number;
  carName: string;
  compact?: boolean;
  onDeleted?: (message: string) => void;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    if (
      isDeleting ||
      !window.confirm(
        `Retirer ${carName} de la flotte active ? Son historique sera conservé si nécessaire.`,
      )
    )
      return;

    setIsDeleting(true);
    setError("");
    const result = await carsAPI.delete(carId);
    if (result.success) {
      onDeleted?.(result.data?.message || "Voiture retirée de la flotte.");
      router.refresh();
      return;
    }
    setError(result.error || "Suppression impossible.");
    setIsDeleting(false);
  };

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={isDeleting}
        aria-label={`Supprimer ${carName}`}
        title={error || `Supprimer ${carName}`}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 font-bold text-red-400 transition hover:bg-red-500/15 disabled:cursor-wait disabled:opacity-50 ${
          compact ? "h-8 px-2 text-[11px]" : "h-9 px-2.5 text-xs"
        }`}
      >
        {isDeleting ? <LoaderCircle className="animate-spin" size={15} /> : <Trash2 size={15} />}
        {!compact && (isDeleting ? "Traitement…" : "Supprimer")}
      </button>
      {error && (
        <span role="alert" className="absolute right-0 top-full z-20 mt-2 w-72 rounded-lg border border-red-500/30 bg-slate-950 p-2 text-xs font-medium text-red-300 shadow-xl">
          {error}
        </span>
      )}
    </span>
  );
}
