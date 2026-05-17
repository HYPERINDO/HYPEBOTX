import { useAuth } from "./useAuth.js";

export function useRole() {
  const { user } = useAuth();
  return {
    role: user?.role || null,
    isOwner: user?.role === "owner",
    isAdmin: user?.role === "admin",
    isPenjoki: user?.role === "penjoki",
  };
}
