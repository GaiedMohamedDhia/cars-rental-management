/**
 * Main Type Definitions Export
 * Import from here in your components
 */

// Cars
export type {
  Car,
  CreateCarInput,
  UpdateCarInput,
  CarResponse,
  CarsListResponse,
  DeleteCarResponse,
} from './cars'

// Renters
export type {
  Renter,
  CreateRenterInput,
  UpdateRenterInput,
  RenterResponse,
  RentersListResponse,
  DeleteRenterResponse,
} from './renters'

// Rentals
export type {
  Rental,
  CreateRentalInput,
  UpdateRentalInput,
  RentalResponse,
  RentalsListResponse,
  DeleteRentalResponse,
} from './rentals'

// Auth
export type {
  User,
  RegisterInput,
  LoginInput,
  AuthResponse,
  UpdateUserInput,
} from './auth'

export type { Payment, CreatePaymentInput, UpdatePaymentInput } from './payments'

// Maintenance
export type {
  Maintenance,
  CreateMaintenanceInput,
  UpdateMaintenanceInput,
  MaintenancesListResponse,
} from './maintenance'

// API
export type {
  ApiResponse,
  ApiError,
  HealthCheckResponse,
  MessageResponse,
  PaginationParams,
  SearchParams,
  FilterParams,
} from './api'











