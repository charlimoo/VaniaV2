// --- Custom Error for API Responses ---
/**
 * Extends the native Error class to include an HTTP status code.
 * This allows upstream error handlers (like `handleBillingError`) to make decisions
 * based on the specific type of error (e.g., 401 vs 402 vs 500).
 */
export class ApiError extends Error {
  status: number;
  detail: any; // Can hold a string or a JSON object with validation errors

  constructor(message: string, status: number, detail?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail || message;
  }
}

// --- Configuration ---
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// --- Authentication Helpers ---
/**
 * Retrieves the JWT access token from localStorage for client-side requests.
 * Returns an empty object for server-side rendering to prevent errors.
 */
export const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") {
    return {};
  }
  
  const token = localStorage.getItem("accessToken");
  
  return token ? { "Authorization": `Bearer ${token}` } : {};
};

/**
 * A standardized fetch wrapper for API calls.
 * - Automatically adds Content-Type for JSON.
 * - Throws a structured `ApiError` for non-2xx responses.
 * - Parses successful JSON responses.
 *
 * @param url The API endpoint (relative to API_BASE_URL).
 * @param options Standard RequestInit options (method, headers, body, etc.).
 * @returns A promise that resolves with the JSON response data.
 */
export async function fetcher<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const defaultHeaders: Record<string, string> = {
    ...getAuthHeaders(),
  };

  // Only add Content-Type if a body exists and it's not FormData
  if (options.body && !(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });
  
  if (!res.ok) {
    let errorMessage = `API Error: ${res.status}`;
    let errorDetail: any = res.statusText;
    
    // Try to parse a JSON error response from the backend
    try {
      const data = await res.json();
      // Handle Django DRF's common error formats
      errorMessage = data.message || data.error || data.detail || errorMessage;
      errorDetail = data;
    } catch {
      // If parsing fails, use the raw status text
    }

    throw new ApiError(errorMessage, res.status, errorDetail);
  }
  
  // Handle successful but empty responses (e.g., DELETE 204 No Content)
  if (res.status === 204) {
    return null as T;
  }

  return res.json();
}


export async function checkUserExistence(phone: string) {
  return fetcher<{ exists: boolean }>('/api/auth/check-exists/', {
    method: 'POST',
    body: JSON.stringify({ phone_number: phone })
  });
}

export async function verifyDoctorCredentials(fullName: string, code: string) {
  return fetcher<{ verified: boolean; message: string; found_name?: string }>('/api/auth/verify-doctor/', {
    method: 'POST',
    body: JSON.stringify({ full_name: fullName, license_code: code })
  });
}