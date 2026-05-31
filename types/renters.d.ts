/**
 * Renter Type Definitions
 */

export interface Renter {
  id: number
  nom: string
  prenom: string
  adresse: string
  createdAt: string
  updatedAt: string
  rentals?: import('./rentals').Rental[]
}

export interface CreateRenterInput {
  nom: string
  prenom: string
  adresse: string
}

export interface UpdateRenterInput {
  nom?: string
  prenom?: string
  adresse?: string
}

export interface RenterResponse {
  success: boolean
  data?: Renter
  error?: string
}

export interface RentersListResponse {
  success: boolean
  data?: Renter[]
  error?: string
}

export interface DeleteRenterResponse {
  success: boolean
  data?: { message: string }
  error?: string
}







