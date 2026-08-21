export interface Payment {
  id: number
  invoice_number?: string | null
  rental_id: number
  amount: number
  method: string
  status: string
  payment_date: string
  reference?: string | null
  notes?: string | null
  created_by?: number | null
  created_at: string
  creator?: import('./auth').User | null
}

export interface CreatePaymentInput {
  rental_id: number
  amount: number
  method: string
  payment_date?: string
  reference?: string
  notes?: string
}

export interface UpdatePaymentInput {
  amount?: number
  method?: 'Espèces' | 'Carte bancaire' | 'Virement bancaire' | 'Chèque'
  status?: 'Payé' | 'En attente' | 'Annulé' | 'Partiellement payé'
  payment_date?: string
  reference?: string | null
  notes?: string | null
}
