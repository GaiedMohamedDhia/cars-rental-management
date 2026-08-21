/**
 * Auth Type Definitions
 */

export interface User {
  id: number
  username: string
  email: string
  nom: string
  prenom: string
  telephone?: string | null
  age?: number | null
  sexe?: string | null
  poste?: string | null
  photoUrl?: string | null
  last_login?: string | null
  role: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UpdateUserInput {
  nom?: string
  prenom?: string
  email?: string
  telephone?: string | null
  age?: number | null
  sexe?: string | null
  poste?: string | null
  photoUrl?: string | null
}

export interface RegisterInput {
  username?: string
  email: string
  password: string
  password_confirmation: string
  nom?: string
  prenom?: string
  telephone?: string
  age?: number | null
  sexe?: string | null
  poste?: string | null
  photoUrl?: string | null
}

export interface LoginInput {
  identifier: string
  password: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}
