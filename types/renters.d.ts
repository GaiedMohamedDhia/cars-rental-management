/**
 * Renter Type Definitions
 */

export interface Renter {
  id: number
  nom: string
  prenom: string
  adresse: string
  telephone?: string | null
  email?: string | null
  cin?: string | null
  ville?: string | null
  photoUrl?: string | null
  is_active?: boolean
  createdAt: string
  updatedAt: string
  rentals?: import('./rentals').Rental[]
}

export interface CreateRenterInput {
  nom: string
  prenom: string
  adresse: string
  telephone?: string | null
  email?: string | null
  cin?: string | null
  ville?: string | null
  photoUrl?: string | null
}

export interface UpdateRenterInput {
  nom?: string
  prenom?: string
  adresse?: string
  telephone?: string | null
  email?: string | null
  cin?: string | null
  ville?: string | null
  photoUrl?: string | null
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







