/**
 * Car Type Definitions
 */

export interface Car {
  id: number
  numImma: string
  marque: string
  modele: string
  photoUrl?: string | null
  kilometrage: number
  etat: number // 0: available, 1: rented
  prixLocation: number
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
  etat?: number
}

export interface UpdateCarInput {
  numImma?: string
  marque?: string
  modele?: string
  kilometrage?: number
  prixLocation?: number
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










