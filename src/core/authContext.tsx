import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { getAppSetting, initDatabase, setAppSetting, syncRulesFromPayload } from './db';
import { ShiftSession } from './types';

interface AuthContextType {
  session: ShiftSession | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  apiBaseUrl: string;
  setApiBaseUrl: (url: string) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  updateSessionPermissions: (newPerms: Record<string, boolean>, role?: string) => Promise<void>;
  markOfflineCheckout: () => Promise<void>;
  clearOfflineCheckout: () => Promise<void>;
  login: (token: string, payload: any, publicKeyId?: number) => Promise<void>;
  logout: () => Promise<void>;
}

const DEFAULT_API_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ShiftSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [apiBaseUrl, setApiBaseUrlState] = useState<string>(DEFAULT_API_URL);

  useEffect(() => {
    async function restore() {
      try {
        await initDatabase();
        const savedUrl = await getAppSetting('api_base_url', DEFAULT_API_URL);
        if (savedUrl) setApiBaseUrlState(savedUrl);

        const savedSessionJson = await getAppSetting('active_session', '');
        if (savedSessionJson) {
          const parsed: ShiftSession = JSON.parse(savedSessionJson);
          const nowSec = Math.floor(Date.now() / 1000);
          if (parsed.exp && parsed.exp > nowSec) {
            setSession(parsed);
          } else {
            await setAppSetting('active_session', '');
          }
        }
      } catch (e) {
        console.warn('Failed restoring auth session:', e);
      } finally {
        setIsLoading(false);
      }
    }
    void restore();
  }, []);

  const setApiBaseUrl = async (url: string) => {
    const trimmed = url.trim().replace(/\/+$/, '');
    setApiBaseUrlState(trimmed);
    await setAppSetting('api_base_url', trimmed);
  };

  const hasPermission = (perm: string): boolean => {
    if (!session) return false;
    if (session.role === 'admin' || session.permissions?.['*'] === true) {
      return true;
    }

    if (session.permissions?.[perm] === true) {
      return true;
    }

    // Common synonyms / prefixes from jwt_api
    if (perm === 'scans.create') {
      return (
        session.permissions?.['scans.create'] === true ||
        session.permissions?.['scan'] === true ||
        session.permissions?.['user.scan.create'] === true
      );
    }

    if (perm === 'scans.view' || perm === 'scans.view.own') {
      return (
        session.permissions?.['scans.view'] === true ||
        session.permissions?.['scans.view.own'] === true ||
        session.permissions?.['scans.view.any'] === true ||
        session.permissions?.['user.history.view'] === true ||
        session.permissions?.['user.view.self'] === true
      );
    }

    if (perm === 'inventory_rules.view') {
      return (
        session.permissions?.['inventory_rules.view'] === true ||
        session.permissions?.['inventory_rules'] === true ||
        session.permissions?.['inventory_rules.create'] === true ||
        session.permissions?.['inventory_rules.update'] === true ||
        session.permissions?.['inventory_rules.delete'] === true
      );
    }

    if (perm === 'inventory_rules.create') {
      return (
        session.permissions?.['inventory_rules.create'] === true ||
        session.permissions?.['inventory_rules'] === true
      );
    }

    if (perm === 'inventory_rules.update') {
      return (
        session.permissions?.['inventory_rules.update'] === true ||
        session.permissions?.['inventory_rules'] === true
      );
    }

    if (perm === 'inventory_rules.delete') {
      return (
        session.permissions?.['inventory_rules.delete'] === true ||
        session.permissions?.['inventory_rules'] === true
      );
    }

    if (perm === 'keys.view') {
      return (
        session.permissions?.['keys.view'] === true ||
        session.permissions?.['keys'] === true ||
        session.permissions?.['keys.create'] === true ||
        session.permissions?.['keys.update'] === true ||
        session.permissions?.['keys.revoke'] === true ||
        session.permissions?.['keys.delete'] === true
      );
    }

    if (perm === 'keys.create') {
      return (
        session.permissions?.['keys.create'] === true ||
        session.permissions?.['keys'] === true
      );
    }

    if (perm === 'keys.update') {
      return (
        session.permissions?.['keys.update'] === true ||
        session.permissions?.['keys'] === true
      );
    }

    if (perm === 'keys.delete' || perm === 'keys.revoke') {
      return (
        session.permissions?.['keys.delete'] === true ||
        session.permissions?.['keys.revoke'] === true ||
        session.permissions?.['keys'] === true
      );
    }

    if (perm === 'scans.update') {
      return (
        session.permissions?.['scans.update'] === true ||
        session.permissions?.['user.history.update'] === true ||
        session.permissions?.['user.update.self'] === true
      );
    }

    if (perm === 'scans.delete') {
      return (
        session.permissions?.['scans.delete'] === true ||
        session.permissions?.['user.history.delete'] === true ||
        session.permissions?.['user.delete.self'] === true
      );
    }

    return false;
  };

  const login = async (token: string, payload: any, publicKeyId?: number) => {
    const perms: Record<string, boolean> = typeof payload.permissions === 'object' && payload.permissions !== null
      ? { ...payload.permissions }
      : {};

    // Standard shift operator defaults for mobile worker:
    if (perms['scans.view.own'] === undefined) perms['scans.view.own'] = true;
    if (perms['scans.create'] === undefined) perms['scans.create'] = true;
    if (perms['inventory_rules.view'] === undefined) perms['inventory_rules.view'] = true;

    const newSession: ShiftSession = {
      token: token.trim(),
      sub: String(payload.sub || payload.email || 'operator'),
      userId: Number(payload.user_id || 0),
      shiftId: String(payload.shift_id || ''),
      keyId: payload.key_id ? String(payload.key_id) : undefined,
      role: payload.role ? String(payload.role) : 'user',
      permissions: perms,
      rules: Array.isArray(payload.rules) ? payload.rules : [],
      exp: Number(payload.exp || 0),
      iat: Number(payload.iat || 0),
      publicKeyId,
    };

    // Store embedded inventory rules to local SQLite DB
    if (newSession.rules && newSession.rules.length > 0) {
      try {
        await syncRulesFromPayload(newSession.rules);
      } catch (err) {
        console.warn('Could not auto-sync rules from token:', err);
      }
    }

    setSession(newSession);
    await setAppSetting('active_session', JSON.stringify(newSession));
  };

  const updateSessionPermissions = useCallback(async (newPerms: Record<string, boolean>, role?: string) => {
    setSession(prev => {
      if (!prev) return null;
      const updated: ShiftSession = {
        ...prev,
        role: role || prev.role,
        permissions: newPerms,
      };
      void setAppSetting('active_session', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const markOfflineCheckout = useCallback(async () => {
    setSession(prev => {
      if (!prev) return null;
      const updated: ShiftSession = {
        ...prev,
        offlineCheckoutPending: true,
      };
      void setAppSetting('active_session', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearOfflineCheckout = useCallback(async () => {
    setSession(prev => {
      if (!prev) return null;
      const updated: ShiftSession = {
        ...prev,
        offlineCheckoutPending: false,
      };
      void setAppSetting('active_session', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const logout = useCallback(async () => {
    setSession(null);
    await setAppSetting('active_session', '');
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoggedIn: Boolean(session && session.exp > Math.floor(Date.now() / 1000)),
        isLoading,
        apiBaseUrl,
        setApiBaseUrl,
        hasPermission,
        updateSessionPermissions,
        markOfflineCheckout,
        clearOfflineCheckout,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
