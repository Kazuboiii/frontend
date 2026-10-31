export interface AuthUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: number;
  role_name: string;
  role_code: string | null;
  business_unit: number | null;
  business_unit_name: string | null;
  business_unit_code: string | null;
  is_active: boolean;
  is_approved: boolean;
  is_staff: boolean;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function setTokens(access: string, refresh: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("auth_api_base");
}

export function getUserFromStorage(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setUser(user: AuthUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearUser() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("user");
}

export function hasRole(roleCode: string | null): boolean {
  const u = getUserFromStorage();
  return u ? u.role_code === roleCode : false;
}

export function isSuperAdmin(): boolean {
  return hasRole("super_admin");
}

export function isHealthcareAdmin(): boolean {
  const u = getUserFromStorage();
  return u ? u.role_code === "healthcare_admin" || u.role_code === "super_admin" : false;
}

export function isResortAdmin(): boolean {
  const u = getUserFromStorage();
  return u ? u.role_code === "resort_admin" || u.role_code === "super_admin" : false;
}
