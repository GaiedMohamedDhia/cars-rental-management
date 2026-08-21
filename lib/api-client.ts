import type {
  ApiResponse,
  AuthResponse,
  CreateCarInput,
  CreateMaintenanceInput,
  CreateRenterInput,
  CreateRentalInput,
  HealthCheckResponse,
  LoginInput,
  Maintenance,
  MessageResponse,
  RegisterInput,
  Rental,
  Renter,
  UpdateCarInput,
  UpdateMaintenanceInput,
  UpdateRenterInput,
  UpdateRentalInput,
  User,
  Car,
  Payment,
  CreatePaymentInput,
  UpdatePaymentInput,
  UpdateUserInput,
} from "@/types";

const TOKEN_KEY = "cars-rental-token";

export const authStorage = {
  getToken: () => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  setToken: (token: string) => {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.setItem(TOKEN_KEY, token);
  },
  clearToken: () => {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.removeItem(TOKEN_KEY);
  },
};

const getApiBaseUrl = () => {
  if (typeof window === "undefined") {
    const internalApiUrl = process.env.INTERNAL_API_BASE_URL;
    if (!internalApiUrl) {
      throw new Error("INTERNAL_API_BASE_URL is not configured");
    }
    return internalApiUrl.replace(/\/+$/, "");
  }

  return "/api";
};

async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit & { auth?: boolean }
): Promise<ApiResponse<T>> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const headers = new Headers(options?.headers);

    if (!(options?.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    if (options?.auth) {
      const token = authStorage.getToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }

    const response = await fetch(`${apiBaseUrl}${endpoint}`, {
      ...options,
      cache: "no-store",
      headers,
    });

    const responseData = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = responseData?.detail;
      const validationMessage = Array.isArray(detail)
        ? detail
            .map((item: { loc?: Array<string | number>; msg?: string }) => {
              const field = item.loc?.at(-1);
              return `${field ? `${String(field)} : ` : ""}${item.msg || "Valeur invalide"}`;
            })
            .join(" · ")
        : null;
      const defaultMessages: Record<number, string> = {
        401: "Votre session est absente ou expirée. Veuillez vous reconnecter.",
        403: "Vous n’avez pas la permission d’effectuer cette opération.",
        404: "La ressource demandée est introuvable.",
        409: "Cette opération entre en conflit avec des données existantes.",
        422: "Les données envoyées sont invalides.",
        500: "Le backend a rencontré une erreur interne.",
        502: "Le serveur FastAPI est momentanément inaccessible.",
        503: "Le service backend est temporairement indisponible.",
      };
      return {
        success: false,
        error:
          validationMessage ||
          (typeof detail === "string" ? detail : null) ||
          responseData?.message ||
          defaultMessages[response.status] ||
          `Erreur HTTP ${response.status}`,
        status: response.status,
      };
    }

    return {
      success: true,
      data: responseData,
      status: response.status,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Network error";
    if (typeof window === "undefined") {
      console.error("API Error:", errorMessage);
    }

    return {
      success: false,
      error:
        errorMessage === "Failed to fetch"
          ? "Impossible de contacter l'API. Vérifiez que le backend FastAPI est démarré."
          : errorMessage,
    };
  }
}

export const authAPI = {
  register: async (data: RegisterInput) => {
    return apiFetch<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  login: async (data: LoginInput) => {
    return apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  me: async () => {
    return apiFetch<User>("/auth/me", { auth: true });
  },

  updateMe: async (data: UpdateUserInput) => apiFetch<User>("/auth/me", {
    method: "PATCH", auth: true, body: JSON.stringify(data),
  }),

  changePassword: async (data: { current_password: string; new_password: string }) =>
    apiFetch<MessageResponse>("/auth/me/password", { method: "PATCH", auth: true, body: JSON.stringify(data) }),

  logout: () => {
    authStorage.clearToken();
  },
};

export const paymentsAPI = {
  getAll: () => apiFetch<Payment[]>("/payments/", { auth: true }),
  getById: (id: number) => apiFetch<Payment>(`/payments/${id}`, { auth: true }),
  create: (data: CreatePaymentInput) => apiFetch<Payment>("/payments/", {
    method: "POST", auth: true, body: JSON.stringify(data),
  }),
  update: (id: number, data: UpdatePaymentInput) => apiFetch<Payment>(`/payments/${id}`, {
    method: "PATCH", auth: true, body: JSON.stringify(data),
  }),
  delete: (id: number) => apiFetch<MessageResponse>(`/payments/${id}`, { method: "DELETE", auth: true }),
};

export const carsAPI = {
  getAll: async (availableOnly = false) => {
    const endpoint = availableOnly
      ? "/cars?available_only=true"
      : "/cars";

    return apiFetch<Car[]>(endpoint, { auth: true });
  },

  getById: async (id: number) => {
    return apiFetch<Car>(`/cars/${id}`, { auth: true });
  },

  create: async (data: CreateCarInput) => {
    return apiFetch<Car>("/cars", {
      method: "POST",
      auth: true,
      body: JSON.stringify(data),
    });
  },

  update: async (id: number, data: UpdateCarInput) => {
    return apiFetch<Car>(`/cars/${id}`, {
      method: "PUT",
      auth: true,
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number) => {
    return apiFetch<MessageResponse>(`/cars/${id}`, {
      method: "DELETE",
      auth: true,
    });
  },
};

export const rentersAPI = {
  getAll: async (search?: string) => {
    const endpoint = search
      ? `/renters?search=${encodeURIComponent(search)}`
      : "/renters";

    return apiFetch<Renter[]>(endpoint, { auth: true });
  },

  getById: async (id: number) => {
    return apiFetch<Renter>(`/renters/${id}`, { auth: true });
  },

  create: async (data: CreateRenterInput) => {
    return apiFetch<Renter>("/renters", {
      method: "POST",
      auth: true,
      body: JSON.stringify(data),
    });
  },

  update: async (id: number, data: UpdateRenterInput) => {
    return apiFetch<Renter>(`/renters/${id}`, {
      method: "PUT",
      auth: true,
      body: JSON.stringify(data),
    });
  },

  uploadPhoto: async (id: number, photo: File) => {
    const body = new FormData();
    body.append("photo", photo);
    return apiFetch<Renter>(`/renters/${id}/photo`, {
      method: "POST",
      auth: true,
      body,
    });
  },

  deletePhoto: async (id: number) => {
    return apiFetch<Renter>(`/renters/${id}/photo`, {
      method: "DELETE",
      auth: true,
    });
  },

  delete: async (id: number) => {
    return apiFetch<MessageResponse>(`/renters/${id}`, {
      method: "DELETE",
      auth: true,
    });
  },

  search: async (query: string) => {
    return apiFetch<Renter[]>(`/renters?search=${encodeURIComponent(query)}`, { auth: true });
  },
};

export const rentalsAPI = {
  getAll: async (activeOnly = false) => {
    const endpoint = activeOnly
      ? "/rentals/?active_only=true"
      : "/rentals/";

    return apiFetch<Rental[]>(endpoint, { auth: true });
  },

  getById: async (id: number) => {
    return apiFetch<Rental>(`/rentals/${id}`, { auth: true });
  },

  getByCar: async (carId: number) => {
    return apiFetch<Rental[]>(`/rentals/car/${carId}`, { auth: true });
  },

  getByRenter: async (renterId: number) => {
    return apiFetch<Rental[]>(`/rentals/renter/${renterId}`, { auth: true });
  },

  create: async (data: CreateRentalInput) => {
    return apiFetch<Rental>("/rentals/", {
      method: "POST",
      auth: true,
      body: JSON.stringify(data),
    });
  },

  update: async (id: number, data: UpdateRentalInput) => {
    return apiFetch<Rental>(`/rentals/${id}`, {
      method: "PUT",
      auth: true,
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number) => {
    return apiFetch<MessageResponse>(`/rentals/${id}`, {
      method: "DELETE",
      auth: true,
    });
  },
};

export const healthAPI = {
  check: async () => {
    return apiFetch<HealthCheckResponse>("/health");
  },
};

export const maintenanceAPI = {
  getAll: async () => {
    return apiFetch<Maintenance[]>("/maintenance", { auth: true });
  },

  getById: async (id: number) => {
    return apiFetch<Maintenance>(`/maintenance/${id}`, { auth: true });
  },

  create: async (data: CreateMaintenanceInput) => {
    return apiFetch<Maintenance>("/maintenance", {
      method: "POST",
      auth: true,
      body: JSON.stringify(data),
    });
  },

  update: async (id: number, data: UpdateMaintenanceInput) => {
    return apiFetch<Maintenance>(`/maintenance/${id}`, {
      method: "PUT",
      auth: true,
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number) => {
    return apiFetch<MessageResponse>(`/maintenance/${id}`, {
      method: "DELETE",
      auth: true,
    });
  },
};

const apiClient = {
  auth: authAPI,
  cars: carsAPI,
  renters: rentersAPI,
  rentals: rentalsAPI,
  maintenance: maintenanceAPI,
  health: healthAPI,
  payments: paymentsAPI,
};

export default apiClient;
