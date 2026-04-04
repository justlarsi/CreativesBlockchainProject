/**
 * Auth API Client
 * Handles user registration, login, token refresh, and logout
 */

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  bio?: string;
  is_email_verified: boolean;
  created_at: string;
  date_joined: string;
}

export interface AuthResponse {
  user: User;
  access: string;
  refresh: string;
}

export interface RefreshTokenPayload {
  refresh: string;
}

export interface RefreshTokenResponse {
  access: string;
}

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

async function parseJsonOrThrow(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.detail || data?.error || "Request failed");
  }
  return data;
}

/**
 * Register a new user
 */
export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const response = await fetch(`${apiBase}/api/v1/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response);
}

/**
 * Login with username and password
 */
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const response = await fetch(`${apiBase}/api/v1/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response);
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshTokenResponse> {
  const response = await fetch(`${apiBase}/api/v1/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: refreshToken }),
  });
  return parseJsonOrThrow(response);
}

/**
 * Logout and blacklist refresh token
 */
export async function logout(refreshToken: string, accessToken: string): Promise<void> {
  const response = await fetch(`${apiBase}/api/v1/auth/logout/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ refresh: refreshToken }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.detail || "Logout failed");
  }
}

/**
 * Get current user profile (requires access token)
 */
export async function getCurrentUser(accessToken: string): Promise<User> {
  const response = await fetch(`${apiBase}/api/v1/auth/me/`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await parseJsonOrThrow(response);
  return data;
}

export interface UpdateProfilePayload {
  first_name?: string;
  last_name?: string;
  bio?: string;
}

/**
 * Update user profile (requires access token)
 */
export async function updateProfile(
  payload: UpdateProfilePayload,
  accessToken: string,
): Promise<User> {
  const response = await fetch(`${apiBase}/api/v1/auth/me/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrThrow(response);
  return data;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

/**
 * Change user password (requires access token)
 */
export async function changePassword(
  payload: ChangePasswordPayload,
  accessToken: string,
): Promise<{ detail: string }> {
  const response = await fetch(`${apiBase}/api/v1/auth/password-change/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response);
}
