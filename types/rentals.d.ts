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
  kmDebut: number
  kmFin: number | null
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
  montantTotal?: number
}

export interface UpdateRentalInput {
  dateFin?: string
  kmFin?: number
  montantTotal?: number
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











