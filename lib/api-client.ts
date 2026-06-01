import type {
  Car,
  CreateCarInput,
  UpdateCarInput,
  Renter,
  CreateRenterInput,
  UpdateRenterInput,
  Rental,
  CreateRentalInput,
  UpdateRentalInput,
  ApiResponse,
  HealthCheckResponse,
  MessageResponse,
} from "@/types";

const getApiBaseUrl = () => {
  // Server-side: use the backend URL directly
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  }
  // Client-side: use relative path (will be rewrote by Next.js)
  return process.env.NEXT_PUBLIC_API_BASE_URL || "/api";
};

async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}${endpoint}`, {
      ...options,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);

      return {
        success: false,
        error: errorData?.detail || `HTTP error! status: ${response.status}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      data,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Network error";
    if (typeof window === "undefined") {
      // Server-side: safe logging without object serialization
      console.error("API Error:", errorMessage);
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

export const carsAPI = {
  getAll: async (availableOnly = false) => {
    const endpoint = availableOnly
      ? "/cars/?available_only=true"
      : "/cars/";

    return apiFetch<Car[]>(endpoint);
  },

  getById: async (id: number) => {
    return apiFetch<Car>(`/cars/${id}`);
  },

  create: async (data: CreateCarInput) => {
    return apiFetch<Car>("/cars/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update: async (id: number, data: UpdateCarInput) => {
    return apiFetch<Car>(`/cars/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number) => {
    return apiFetch<MessageResponse>(`/cars/${id}`, {
      method: "DELETE",
    });
  },
};

export const rentersAPI = {
  getAll: async (search?: string) => {
    const endpoint = search
      ? `/renters/?search=${encodeURIComponent(search)}`
      : "/renters/";

    return apiFetch<Renter[]>(endpoint);
  },

  getById: async (id: number) => {
    return apiFetch<Renter>(`/renters/${id}`);
  },

  create: async (data: CreateRenterInput) => {
    return apiFetch<Renter>("/renters/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update: async (id: number, data: UpdateRenterInput) => {
    return apiFetch<Renter>(`/renters/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number) => {
    return apiFetch<MessageResponse>(`/renters/${id}`, {
      method: "DELETE",
    });
  },

  search: async (query: string) => {
    return apiFetch<Renter[]>(`/renters/?search=${encodeURIComponent(query)}`);
  },
};

export const rentalsAPI = {
  getAll: async (activeOnly = false) => {
    const endpoint = activeOnly
      ? "/rentals/?active_only=true"
      : "/rentals/";

    return apiFetch<Rental[]>(endpoint);
  },

  getById: async (id: number) => {
    return apiFetch<Rental>(`/rentals/${id}`);
  },

  getByCar: async (carId: number) => {
    return apiFetch<Rental[]>(`/rentals/car/${carId}`);
  },

  getByRenter: async (renterId: number) => {
    return apiFetch<Rental[]>(`/rentals/renter/${renterId}`);
  },

  create: async (data: CreateRentalInput) => {
    return apiFetch<Rental>("/rentals/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update: async (id: number, data: UpdateRentalInput) => {
    return apiFetch<Rental>(`/rentals/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number) => {
    return apiFetch<MessageResponse>(`/rentals/${id}`, {
      method: "DELETE",
    });
  },
};

export const healthAPI = {
  check: async () => {
    return apiFetch<HealthCheckResponse>("/health");
  },
};

const apiClient = {
  cars: carsAPI,
  renters: rentersAPI,
  rentals: rentalsAPI,
  health: healthAPI,
};

export default apiClient;