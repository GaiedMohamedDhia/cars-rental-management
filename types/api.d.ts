/**
 * API Response Types
 */

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  status?: number
}

export interface ApiError {
  detail: string
  message?: string
}

export interface HealthCheckResponse {
  status: string
  message: string
}

export interface MessageResponse {
  message: string
}

export interface PaginationParams {
  skip?: number
  limit?: number
}

export interface SearchParams {
  search?: string
}

export interface FilterParams {
  available_only?: boolean
  active_only?: boolean
}













