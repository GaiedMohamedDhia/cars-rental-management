/**
 * Maintenance Type Definitions
 */

import type { Car } from './cars'

export interface Maintenance {
  id: number
  car_id: number
  type_maintenance: string
  description?: string | null
  date_maintenance: string
  cout?: number | null
  kilometrage?: number | null
  statut: string
  created_at: string
  updated_at: string
  car?: Car
}

export interface CreateMaintenanceInput {
  car_id: number
  type_maintenance: string
  description?: string
  date_maintenance?: string
  cout?: number | null
  kilometrage?: number | null
  statut?: string
}

export interface UpdateMaintenanceInput {
  car_id?: number
  type_maintenance?: string
  description?: string
  date_maintenance?: string
  cout?: number | null
  kilometrage?: number | null
  statut?: string
}

export interface MaintenancesListResponse {
  success: boolean
  data?: Maintenance[]
  error?: string
}
