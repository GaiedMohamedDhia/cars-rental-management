/**
 * Car Type Definitions
 */

export interface Car {
  id: number
  numImma: string
  marque: string
  modele: string
  photoUrl?: string | null
  annee?: number | null
  carburant?: string | null
  transmission?: string | null
  nombrePlaces?: number | null
  couleur?: string | null
  categorie?: string | null
  kilometrage: number
  etat: number // 0: available, 1: rented, 2: maintenance, 3: unavailable
  prixLocation: number
  is_active?: boolean
  createdAt: string
  updatedAt: string
  rentals?: import('./rentals').Rental[]
}

export interface CreateCarInput {
  numImma: string
  marque: string
  modele: string
  kilometrage: number
  prixLocation: number
  photoUrl?: string | null
  annee?: number | null
  carburant?: string | null
  transmission?: string | null
  nombrePlaces?: number | null
  couleur?: string | null
  categorie?: string | null
  etat?: number
}

export interface UpdateCarInput {
  numImma?: string
  marque?: string
  modele?: string
  kilometrage?: number
  prixLocation?: number
  photoUrl?: string | null
  annee?: number | null
  carburant?: string | null
  transmission?: string | null
  nombrePlaces?: number | null
  couleur?: string | null
  categorie?: string | null
  etat?: number
}

export interface CarResponse {
  success: boolean
  data?: Car
  error?: string
}

export interface CarsListResponse {
  success: boolean
  data?: Car[]
  error?: string
}

export interface DeleteCarResponse {
  success: boolean
  data?: { message: string }
  error?: string
}







