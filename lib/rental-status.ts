import type { Rental } from "@/types";

export type RentalReturnStatus =
  | "Active"
  | "En retard"
  | "À retourner aujourd’hui"
  | "Retournée à temps"
  | "Retournée en retard";

export function rentalDate(value?: string | null) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

export function plannedReturnDate(rental: Rental) {
  return rentalDate(rental.dateFinPrevue || rental.dateFin);
}

export function actualReturnDate(rental: Rental) {
  return rentalDate(rental.dateRetourReelle);
}

export function isReturned(rental: Rental) {
  return actualReturnDate(rental) !== null || (
    rental.kmFin !== null &&
    rental.kmFin !== undefined &&
    Number.isFinite(Number(rental.kmFin))
  );
}

export function getRentalReturnStatus(
  rental: Rental,
  now = new Date(),
): RentalReturnStatus {
  const planned = plannedReturnDate(rental);
  const actual = actualReturnDate(rental);

  if (isReturned(rental)) {
    return actual && planned && actual > planned
      ? "Retournée en retard"
      : "Retournée à temps";
  }

  if (!planned) return "Active";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (planned < today) return "En retard";
  if (planned >= today && planned < tomorrow) return "À retourner aujourd’hui";
  return "Active";
}

export function getReturnDelay(rental: Rental, now = new Date()) {
  const planned = plannedReturnDate(rental);
  if (!planned) return { milliseconds: 0, label: "Aucune échéance" };

  const actual = actualReturnDate(rental);
  const comparison = actual || (isReturned(rental) ? planned : now);
  const milliseconds = Math.max(0, comparison.getTime() - planned.getTime());
  if (milliseconds === 0) return { milliseconds, label: "Aucun retard" };

  const hours = Math.ceil(milliseconds / 3_600_000);
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return {
    milliseconds,
    label: days > 0
      ? `${days} j${remainingHours ? ` ${remainingHours} h` : ""}`
      : `${hours} h`,
  };
}
