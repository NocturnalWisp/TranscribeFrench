import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { subscribeToAuthState } from "../services/auth";
import type { AccessMode } from "../types/auth";

const ACCESS_MODE_STORAGE_KEY = "transcribe-french.access-mode";

const readStoredAccessMode = (): AccessMode | null => {
  const value = sessionStorage.getItem(ACCESS_MODE_STORAGE_KEY);
  return value === "trial" || value === "full" ? value : null;
};

const writeStoredAccessMode = (mode: AccessMode | null): void => {
  if (!mode) {
    sessionStorage.removeItem(ACCESS_MODE_STORAGE_KEY);
    return;
  }

  sessionStorage.setItem(ACCESS_MODE_STORAGE_KEY, mode);
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [accessMode, setAccessModeState] = useState<AccessMode | null>(() => readStoredAccessMode());

  useEffect(() => {
    return subscribeToAuthState((nextUser) => {
      setUser(nextUser);
      setAuthReady(true);

      if (nextUser) {
        setAccessModeState("full");
        writeStoredAccessMode("full");
      }
    });
  }, []);

  const setAccessMode = (mode: AccessMode | null) => {
    setAccessModeState(mode);
    writeStoredAccessMode(mode);
  };

  const clearAccess = () => {
    setAccessMode(null);
  };

  const isTrial = accessMode === "trial" && !user;
  const isAuthenticated = Boolean(user);
  const hasAccess = isAuthenticated || accessMode === "trial";

  return {
    user,
    authReady,
    accessMode,
    setAccessMode,
    clearAccess,
    isTrial,
    isAuthenticated,
    hasAccess
  };
};
