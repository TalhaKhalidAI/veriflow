import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useAuth } from './authContext';
import { upsertPublicKey } from './db';

/**
 * Requirement 4: Live permission and key sync using TanStack Query.
 * - If online: periodically queries the API for updated user permissions and active public keys.
 *   If permissions or keys have changed, updates local session and SQLite.
 * - If offline: does nothing, preserving all existing local permissions and cached keys.
 * - Uses stable memoized refs to prevent infinite re-render loops.
 */
export function useLiveSync() {
  const { session, isLoggedIn, apiBaseUrl, updateSessionPermissions } = useAuth();
  const lastSyncedPermsRef = useRef<string>('');

  // 1. Live Permissions Query using TanStack Query
  const permissionsQuery = useQuery({
    queryKey: ['live_permissions', session?.userId, session?.token],
    queryFn: async () => {
      if (!session?.token) return null;
      const res = await fetch(`${apiBaseUrl}/app/v1/users/users_config/me`, {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      });
      if (!res.ok) {
        throw new Error(`Profile fetch failed: ${res.status}`);
      }
      return res.json();
    },
    enabled: Boolean(isLoggedIn && session?.token),
    refetchInterval: 30000, // Check every 30s
    refetchOnWindowFocus: true,
    retry: false, // Don't spam retries if offline
  });

  useEffect(() => {
    if (!permissionsQuery.data) return;
    const data = permissionsQuery.data;

    const newPermMap: Record<string, boolean> = {};
    if (Array.isArray(data.permissions)) {
      for (const p of data.permissions) {
        newPermMap[p] = true;
      }
    } else if (typeof data.permissions === 'object' && data.permissions !== null) {
      Object.assign(newPermMap, data.permissions);
    }

    const newKeys = Object.keys(newPermMap).filter(k => newPermMap[k]).sort();
    const newKeysSignature = JSON.stringify(newKeys);

    const localPerms = session?.permissions || {};
    const localKeys = Object.keys(localPerms).filter(k => localPerms[k]).sort();
    const localKeysSignature = JSON.stringify(localKeys);

    // Only update if permissions actually differ AND have not already been applied in this cycle
    if (newKeysSignature !== localKeysSignature && newKeysSignature !== lastSyncedPermsRef.current) {
      lastSyncedPermsRef.current = newKeysSignature;
      console.log('[VeriFlow LiveSync] Server permissions updated:', newPermMap);
      void updateSessionPermissions(newPermMap, data.user_role || data.role);
    }
  }, [permissionsQuery.data, updateSessionPermissions]);

  // 2. Live Public Keys (JWKS) Query using TanStack Query
  const keysQuery = useQuery({
    queryKey: ['live_jwks', apiBaseUrl],
    queryFn: async () => {
      const res = await fetch(`${apiBaseUrl}/app/v1/keys/jwks`);
      if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
      return res.json();
    },
    enabled: Boolean(isLoggedIn),
    refetchInterval: 60000, // Check every 60s
    retry: false,
  });

  const lastSyncedKeysRef = useRef<string>('');

  useEffect(() => {
    if (keysQuery.data?.keys && Array.isArray(keysQuery.data.keys)) {
      const keysSignature = JSON.stringify(keysQuery.data.keys.map((k: any) => k.kid || k.id));
      if (keysSignature !== lastSyncedKeysRef.current) {
        lastSyncedKeysRef.current = keysSignature;
        for (const k of keysQuery.data.keys) {
          if (k.kid && k.public_key) {
            void upsertPublicKey(k.kid, k.public_key);
          }
        }
      }
    }
  }, [keysQuery.data]);

  return {
    isPermissionsFetching: permissionsQuery.isFetching,
    isKeysFetching: keysQuery.isFetching,
  };
}
