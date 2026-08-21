/**
 * Rental Type Definitions
 */

import type { Car } from './cars'
import type { Renter } from './renters'

export interface Rental {
  id: number
  carId: number
  renterId: number
  dateDebut: string
  dateFin: string | null
  dateFinPrevue: string | null
  dateRetourReelle: string | null
  kmDebut: number
  kmFin: number | null
  statut: 'Active' | 'En retard' | 'Retournée à temps' | 'Retournée en retard' | string
  montantTotal: number | null
  createdAt: string
  updatedAt: string
  car?: Car
  renter?: Renter
}

export interface CreateRentalInput {
  carId: number
  renterId: number
  kmDebut: number
  dateDebut?: string
  dateFin?: string
  dateFinPrevue?: string
  montantTotal?: number
}

export interface UpdateRentalInput {
  carId?: number
  renterId?: number
  dateDebut?: string
  dateFin?: string
  dateFinPrevue?: string
  dateRetourReelle?: string
  kmDebut?: number
  kmFin?: number
  montantTotal?: number
  statut?: string
}

export interface RentalResponse {
  success: boolean
  data?: Rental
  error?: string
}

export interface RentalsListResponse {
  success: boolean
  data?: Rental[]
  error?: string
}

export interface DeleteRentalResponse {
  success: boolean
  data?: { message: string }
  error?: string
}









