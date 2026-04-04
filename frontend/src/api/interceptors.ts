/**
 * API Interceptors
 * Handles auth header injection, token auto-refresh, and error handling
 */

import { refreshAccessToken } from "./auth";

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

/**
 * Get current access token from localStorage
 */
export function getStoredAccessToken(): string | null {
  return localStorage.getItem("access_token") || localStorage.getItem("access");
}

/**
 * Get current refresh token from localStorage
 */
export function getStoredRefreshToken(): string | null {
  return localStorage.getItem("refresh_token") || localStorage.getItem("refresh");
}

/**
 * Store tokens in localStorage (both old and new key formats for compatibility)
 */
export function storeTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem("access_token", accessToken);
  localStorage.setItem("access", accessToken);
  localStorage.setItem("refresh_token", refreshToken);
  localStorage.setItem("refresh", refreshToken);
}

/**
 * Clear tokens from localStorage
 */
export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("access");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("refresh");
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessTokenIfNeeded(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await refreshAccessToken(refreshToken);
    storeTokens(response.access, refreshToken);
    return response.access;
  } catch (error) {
    console.error("Token refresh failed:", error);
    clearTokens();
    // Redirect to login on refresh failure
    window.location.href = "/login";
    return null;
  }
}

/**
 * Enhanced fetch wrapper with auth header injection and auto-refresh
 */
export async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  let accessToken = getStoredAccessToken();

  // Build URL
  const url = endpoint.startsWith("http") ? endpoint : `${apiBase}${endpoint}`;

  // Prepare headers as a plain object to preserve predictable key casing in tests.
  const baseHeaders: Record<string, string> = (() => {
    if (!options.headers) {
      return {};
    }
    if (options.headers instanceof Headers) {
      return Object.fromEntries(options.headers.entries());
    }
    if (Array.isArray(options.headers)) {
      return Object.fromEntries(options.headers);
    }
    return { ...(options.headers as Record<string, string>) };
  })();

  const hasAuthorizationHeader = Object.keys(baseHeaders).some(
    (key) => key.toLowerCase() === "authorization",
  );
  if (accessToken && !hasAuthorizationHeader) {
    baseHeaders.Authorization = `Bearer ${accessToken}`;
  }

  // Make request
  let response = await fetch(url, {
    ...options,
    headers: baseHeaders,
  });

  // If 401, try to refresh token and retry
  if (response.status === 401 && accessToken) {
    const newAccessToken = await refreshAccessTokenIfNeeded();
    if (newAccessToken) {
      // Retry with new token
      baseHeaders.Authorization = `Bearer ${newAccessToken}`;
      response = await fetch(url, {
        ...options,
        headers: baseHeaders,
      });
    }
  }

  return response;
}

/**
 * Wrapper around authenticatedFetch that parses JSON response
 */
export async function authenticatedFetchJson<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await authenticatedFetch(endpoint, options);

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (typeof data?.detail === "string" && data.detail) ||
      (typeof data?.error === "string" && data.error) ||
      (typeof data?.error?.message === "string" && data.error.message) ||
      (typeof data?.message === "string" && data.message) ||
      "Request failed";
    throw new Error(message);
  }

  return data as T;
}

