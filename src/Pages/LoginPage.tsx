import {
  Box,
  Button,
  ButtonText,
  HStack,
  Heading,
  Input,
  InputField,
  Pressable,
  ScrollView,
  Text,
  VStack,
} from '@gluestack-ui/themed';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  RefreshCw,
  DownloadCloud,
  Key,
  Check,
  Settings,
  AlertCircle,
  LogOut,
  LogIn,
  UploadCloud,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useAuth } from '../core/authContext';
import {
  addPublicKey,
  getPublicKeys,
  getAppSetting,
  setAppSetting,
  getPendingScans,
  markScansAsSynced,
} from '../core/db';
import { normalizePublicKey, verifyJwtAgainstPublicKey } from '../core/jwt';
import { PublicKeyRecord } from '../core/types';

const BLACK = '#07111d';
const PANEL = '#0f172a';
const PANEL_ALT = '#111c2e';
const YELLOW = '#facc15';
const MUTED = '#94a3b8';
const FAIL_COLOR = '#ef4444';
const PASS_COLOR = '#22c55e';

export default function LoginPage() {
  const { login, apiBaseUrl, setApiBaseUrl } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const { width, height } = useWindowDimensions();
  const cameraBoxHeight = Math.min(280, Math.max(190, height * 0.33));

  const [publicKeys, setPublicKeys] = useState<PublicKeyRecord[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [scanCooldown, setScanCooldown] = useState<boolean>(true);
  const [completedShiftPrompt, setCompletedShiftPrompt] = useState<{
    token: string;
    payload: any;
    keyId?: number;
    shiftId: string;
    operator: string;
  } | null>(null);
  const [isStartingNewShift, setIsStartingNewShift] = useState<boolean>(false);

  const [activeShiftPrompt, setActiveShiftPrompt] = useState<{
    token: string;
    payload: any;
    keyId?: number;
    shiftId: string;
    operator: string;
    pendingScansCount: number;
    wasOfflineCheckout: boolean;
  } | null>(null);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState<boolean>(false);

  // 2.5 second scan cooldown on mount to prevent accidental instant re-scans after checkout
  useEffect(() => {
    const t = setTimeout(() => setScanCooldown(false), 2500);
    return () => clearTimeout(t);
  }, []);

  // Modals
  const [keyPickerVisible, setKeyPickerVisible] = useState(false);
  const [addKeyModalVisible, setAddKeyModalVisible] = useState(false);
  const [serverModalVisible, setServerModalVisible] = useState(false);

  // Form states
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPem, setNewKeyPem] = useState('');
  const [serverUrlInput, setServerUrlInput] = useState(apiBaseUrl);
  const [isFetchingServerKeys, setIsFetchingServerKeys] = useState(false);

  const selectedKey = publicKeys.find(k => k.id === selectedKeyId) || publicKeys[0] || null;

  const loadKeys = async (): Promise<PublicKeyRecord[]> => {
    try {
      const keys = await getPublicKeys();
      setPublicKeys(keys);
      if (keys.length > 0 && !selectedKeyId) {
        setSelectedKeyId(keys[0].id);
      }
      return keys;
    } catch (e) {
      console.warn('Error loading keys in login:', e);
      return [];
    }
  };

  const handleFetchServerKeys = async (silent: boolean = false): Promise<PublicKeyRecord[]> => {
    setIsFetchingServerKeys(true);
    try {
      const res = await fetch(`${apiBaseUrl}/app/v1/keys/jwks`, {
        headers: { Accept: 'application/json' },
      }).catch(() => null);

      if (res && res.ok) {
        const jwks = await res.json();
        const keys = jwks.keys || [];
        if (keys.length === 0) {
          if (!silent) {
            Alert.alert('No Keys Found', 'Server returned 0 active keys in JWKS.');
          }
        } else {
          let addedCount = 0;
          for (const k of keys) {
            const pem =
              k.public_key ||
              (k.x5c && k.x5c[0]
                ? `-----BEGIN PUBLIC KEY-----
${k.x5c[0]}
-----END PUBLIC KEY-----`
                : null);

            if (pem) {
              const keyAlias = `Server Key ${k.kid || k.id || ''}`;
              await addPublicKey(keyAlias, pem);
              addedCount++;
            }
          }
          const updated = await loadKeys();
          if (updated.length > 0 && !selectedKeyId) {
            setSelectedKeyId(updated[0].id);
          }
          if (!silent) {
            Alert.alert('Keys Updated', `Successfully fetched and synced ${addedCount} public key(s) from server.`);
          }
          return updated;
        }
      } else {
        if (!silent) {
          Alert.alert(
            'Connection Failed',
            `Could not reach ${apiBaseUrl}/app/v1/keys/jwks. Please check network or API URL.`,
          );
        }
      }
    } catch (e: any) {
      if (!silent) {
        Alert.alert('Error', e.message || 'Failed connecting to server');
      }
    } finally {
      setIsFetchingServerKeys(false);
    }
    return publicKeys;
  };

  useEffect(() => {
    void (async () => {
      const loaded = await loadKeys();
      // Auto-fetch from server if no keys currently stored in SQLite
      if (!loaded || loaded.length === 0) {
        await handleFetchServerKeys(true);
      }
    })();
  }, [apiBaseUrl]);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (isVerifying) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    setIsVerifying(true);
    try {
      const token = data.trim();
      let keyToUse = selectedKey;
      let result = keyToUse
        ? await verifyJwtAgainstPublicKey(token, keyToUse.public_key_string)
        : { valid: false, reason: 'No key selected', status: 'fail' as const };

      // Fallback: If verification failed against selectedKey, try other local keys in SQLite
      if (!result.valid && publicKeys.length > 1) {
        for (const k of publicKeys) {
          if (k.id === keyToUse?.id) continue;
          const retry = await verifyJwtAgainstPublicKey(token, k.public_key_string);
          if (retry.valid && retry.payload) {
            setSelectedKeyId(k.id);
            keyToUse = k;
            result = retry;
            break;
          }
        }
      }

      // If still invalid, try auto-refetching from server API in case keys were rotated
      if (!result.valid) {
        const freshKeys = await handleFetchServerKeys(true);
        for (const k of freshKeys) {
          const retry = await verifyJwtAgainstPublicKey(token, k.public_key_string);
          if (retry.valid && retry.payload) {
            setSelectedKeyId(k.id);
            keyToUse = k;
            result = retry;
            break;
          }
        }
      }

      if (!result.valid || !result.payload) {
        setErrorMessage(result.reason || 'Invalid JWT signature or token expired');
        setIsVerifying(false);
        return;
      }

      const payload = result.payload;
      if (payload.type === 'product_tag') {
        setErrorMessage(
          'Scanned QR is a Product Tag, not an Operator Shift Badge. Please scan your Shift Token QR badge.',
        );
        setIsVerifying(false);
        return;
      }

      if (!payload.shift_id) {
        setErrorMessage(
          'QR badge is missing shift_id. Please scan an active Shift Token QR generated by /app/v1/shifts/start.',
        );
        setIsVerifying(false);
        return;
      }

      // Check if shift is already completed on the server
      try {
        const shiftStatusRes = await fetch(`${apiBaseUrl}/app/v1/shifts/${payload.shift_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null);

        if (shiftStatusRes && shiftStatusRes.ok) {
          const shiftData = await shiftStatusRes.json();
          if (shiftData.status === 'completed' || shiftData.status === 'revoked') {
            setCompletedShiftPrompt({
              token,
              payload,
              keyId: keyToUse?.id,
              shiftId: payload.shift_id,
              operator: String(payload.sub || payload.user_id),
            });
            setIsVerifying(false);
            return;
          }

          // Check if operator had previously selected Offline Checkout or has pending scans to transfer
          const offlineShiftId = await getAppSetting('offline_checkout_shift_id', '');
          const pendingScans = await getPendingScans(payload.user_id);
          const wasOfflineCheckout = offlineShiftId === payload.shift_id;

          if (wasOfflineCheckout || pendingScans.length > 0) {
            setActiveShiftPrompt({
              token,
              payload,
              keyId: keyToUse?.id,
              shiftId: payload.shift_id,
              operator: String(payload.sub || payload.user_id),
              pendingScansCount: pendingScans.length,
              wasOfflineCheckout,
            });
            setIsVerifying(false);
            return;
          }
        }
      } catch (e) {
        console.warn('Server shift status check deferred (offline):', e);
      }

      setSuccessMessage(`Verified! Operator: ${payload.sub || payload.user_id}`);
      await login(token, payload, keyToUse?.id);
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification exception occurred');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResumeShift = async () => {
    if (!activeShiftPrompt) return;
    const prompt = activeShiftPrompt;
    setActiveShiftPrompt(null);
    await setAppSetting('offline_checkout_shift_id', '');
    setSuccessMessage(`Welcome back! Operator: ${prompt.operator}`);
    await login(prompt.token, prompt.payload, prompt.keyId);
  };

  const handleCompleteServerCheckout = async () => {
    if (!activeShiftPrompt) return;
    setIsProcessingCheckout(true);
    setErrorMessage(null);
    const prompt = activeShiftPrompt;
    try {
      const pendingScans = await getPendingScans(prompt.payload.user_id);
      let transferredCount = 0;

      // 1. Bulk sync pending scans if any
      if (pendingScans.length > 0) {
        const scansData = pendingScans.map(s => {
          let claims: Record<string, any> = {};
          try {
            const parts = s.scanned_jwt.split('.');
            if (parts.length >= 2) {
              const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
              const jsonStr = decodeURIComponent(
                atob(base64)
                  .split('')
                  .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                  .join(''),
              );
              claims = JSON.parse(jsonStr);
            }
          } catch {
            claims = { raw_token: s.scanned_jwt };
          }

          return {
            jwt_scanned: claims,
            status: s.status === 'pass' ? 'valid' : 'invalid',
            scanned_at: s.scanned_at || new Date().toISOString(),
            reason: s.notes || (s.status === 'pass' ? 'Verified RS256' : 'Verification failed'),
          };
        });

        const syncUrl = `${apiBaseUrl}/app/v1/scans/shifts/${prompt.shiftId}/sync`;
        const syncRes = await fetch(syncUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${prompt.token}`,
          },
          body: JSON.stringify({ scans: scansData }),
        }).catch(() => null);

        if (syncRes && syncRes.ok) {
          await markScansAsSynced(pendingScans.map(s => s.id));
          transferredCount = pendingScans.length;
        }
      }

      // 2. Checkout shift on API
      const checkoutUrl = `${apiBaseUrl}/app/v1/shifts/${prompt.shiftId}/checkout`;
      let checkoutRes = await fetch(checkoutUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${prompt.token}`,
        },
      }).catch(() => null);

      if (!checkoutRes || !checkoutRes.ok) {
        checkoutRes = await fetch(`${apiBaseUrl}/app/v1/shifts/checkout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${prompt.token}`,
          },
        }).catch(() => null);
      }

      await setAppSetting('offline_checkout_shift_id', '');
      setActiveShiftPrompt(null);
      setSuccessMessage(
        `Shift #${prompt.shiftId.slice(0, 8)} successfully checked out on server!${transferredCount > 0 ? ` (${transferredCount} scans transferred)` : ''}`,
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete server checkout.');
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  const handleStartNewShift = async () => {
    if (!completedShiftPrompt) return;
    setIsStartingNewShift(true);
    setErrorMessage(null);
    try {
      const startRes = await fetch(`${apiBaseUrl}/app/v1/shifts/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${completedShiftPrompt.token}`,
        },
        body: JSON.stringify({
          target_user_id: completedShiftPrompt.payload.user_id,
          duration_hours: 8,
        }),
      });

      if (!startRes.ok) {
        const errData = await startRes.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || `Failed to start shift: ${startRes.status}`);
      }

      const data = await startRes.json();
      if (!data.shift_token) throw new Error('Server did not return a shift token');

      let newPayload = completedShiftPrompt.payload;
      try {
        const parts = data.shift_token.split('.');
        if (parts.length >= 2) {
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const jsonStr = decodeURIComponent(
            atob(base64)
              .split('')
              .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join(''),
          );
          newPayload = JSON.parse(jsonStr);
        }
      } catch {
        // Fallback
      }

      setCompletedShiftPrompt(null);
      setSuccessMessage(`New shift activated! Operator: ${newPayload.sub || newPayload.user_id}`);
      await login(data.shift_token, newPayload, completedShiftPrompt.keyId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not start new shift on server.');
    } finally {
      setIsStartingNewShift(false);
    }
  };

  const handleSaveManualKey = async () => {
    if (!newKeyName.trim() || !newKeyPem.trim()) {
      Alert.alert('Missing fields', 'Please enter a key name and PEM block.');
      return;
    }
    try {
      const normalized = normalizePublicKey(newKeyPem);
      const insertedId = await addPublicKey(newKeyName.trim(), normalized);
      await loadKeys();
      setSelectedKeyId(insertedId);
      setNewKeyName('');
      setNewKeyPem('');
      setAddKeyModalVisible(false);
      Alert.alert('Key Saved', `Saved key "${newKeyName.trim()}"`);
    } catch (err: any) {
      Alert.alert('Invalid Key Format', err.message || 'Could not parse public key PEM.');
    }
  };

  return (
    <Box flex={1} bg={BLACK} px="$4" py="$6" justifyContent="center">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <VStack space="lg" width="100%" maxWidth={540} alignSelf="center">
          {/* Header */}
          <HStack alignItems="center" space="md">
            <Image
              source={require('../assets/msi_white.png')}
              style={{ width: 64, height: 56 }}
              resizeMode="contain"
              accessibilityLabel="VeriFlow logo"
            />
            <VStack space="xs" flex={1}>
              <Heading size="2xl" color={YELLOW} fontWeight="900">
                Operator Check-In
              </Heading>
              <Text fontSize="$sm" color={MUTED}>
                Scan your assigned RS256 shift QR token to access VeriFlow
              </Text>
            </VStack>
          </HStack>

          {/* Key Selection Card */}
          <Box borderWidth={2} borderColor={YELLOW} borderRadius="$xl" bg={PANEL} p="$4">
            <HStack justifyContent="space-between" alignItems="center" mb="$2">
              <Text color="#f8fafc" fontSize="$xs" fontWeight="800" letterSpacing={1}>
                ACTIVE PUBLIC KEY FOR LOGIN
              </Text>

              {/* Quick Re-fetch from API button */}
              <Pressable
                onPress={() => handleFetchServerKeys(false)}
                disabled={isFetchingServerKeys}
                style={styles.refreshBadge}
              >
                <RefreshCw
                  size={12}
                  color={YELLOW}
                  style={isFetchingServerKeys ? { transform: [{ rotate: '45deg' }] } : undefined}
                />
                <Text color={YELLOW} fontSize="$2xs" fontWeight="900" ml="$1">
                  {isFetchingServerKeys ? 'Syncing...' : 'Refetch from API'}
                </Text>
              </Pressable>
            </HStack>

            <Pressable onPress={() => setKeyPickerVisible(true)}>
              <Box
                bg={PANEL_ALT}
                borderWidth={1}
                borderColor="#334155"
                borderRadius="$lg"
                px="$3"
                py="$3"
                flexDirection="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <VStack flex={1} mr="$2">
                  <Text color="#f8fafc" fontSize="$md" fontWeight="700" numberOfLines={1}>
                    {selectedKey ? selectedKey.name : 'No Key Selected (Tap to choose or refetch)'}
                  </Text>
                  {selectedKey ? (
                    <Text color={MUTED} fontSize="$xs" numberOfLines={1}>
                      {selectedKey.public_key_string.slice(0, 48)}...
                    </Text>
                  ) : (
                    <Text color={YELLOW} fontSize="$2xs">
                      Tap &quot;Refetch from API&quot; to auto-download keys
                    </Text>
                  )}
                </VStack>
                <Text color={YELLOW} fontSize="$xl" fontWeight="900">
                  ⌄
                </Text>
              </Box>
            </Pressable>

            {/* Bottom Key Buttons */}
            <HStack space="sm" mt="$3">
              <Button
                flex={1}
                size="sm"
                variant="outline"
                borderColor="#475569"
                onPress={() => setAddKeyModalVisible(true)}
              >
                <ButtonText color="#f8fafc" fontSize="$xs">
                  + Add Key Manually
                </ButtonText>
              </Button>

              <Button
                flex={1}
                size="sm"
                variant="outline"
                borderColor={YELLOW}
                onPress={() => handleFetchServerKeys(false)}
                isDisabled={isFetchingServerKeys}
              >
                {isFetchingServerKeys ? (
                  <ActivityIndicator size="small" color={YELLOW} />
                ) : (
                  <HStack space="xs" alignItems="center">
                    <DownloadCloud size={14} color={YELLOW} />
                    <ButtonText color={YELLOW} fontSize="$xs" fontWeight="800">
                      Refetch from API
                    </ButtonText>
                  </HStack>
                )}
              </Button>
            </HStack>

            {/* Current Server API endpoint link */}
            <HStack justifyContent="flex-end" alignItems="center" mt="$2">
              <Pressable onPress={() => setServerModalVisible(true)}>
                <Text color={MUTED} fontSize="$2xs">
                  Server API: <Text color={YELLOW} fontWeight="700">{apiBaseUrl}</Text> (Tap to configure)
                </Text>
              </Pressable>
            </HStack>
          </Box>

          {/* Camera QR Scanner */}
          <Box borderWidth={2} borderColor={YELLOW} borderRadius="$xl" bg={PANEL} p="$4">
            <Text color="#f8fafc" fontSize="$sm" fontWeight="800" letterSpacing={1} mb="$3">
              SCAN SHIFT QR CODE
            </Text>

            <Box
              h={cameraBoxHeight}
              borderWidth={2}
              borderColor={errorMessage ? FAIL_COLOR : YELLOW}
              borderRadius="$lg"
              overflow="hidden"
              bg="#050914"
              position="relative"
            >
              {permission?.granted ? (
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={(isVerifying || scanCooldown || Boolean(completedShiftPrompt) || Boolean(activeShiftPrompt)) ? undefined : handleBarcodeScanned}
                />
              ) : (
                <VStack flex={1} alignItems="center" justifyContent="center" px="$4">
                  <Text color="#f8fafc" fontSize="$md" fontWeight="800" textAlign="center">
                    Camera permission is required to scan your login QR.
                  </Text>
                  <Button
                    mt="$3"
                    bg={YELLOW}
                    size="sm"
                    onPress={() => requestPermission()}
                  >
                    <ButtonText color={BLACK} fontWeight="800">
                      Grant Camera Permission
                    </ButtonText>
                  </Button>
                </VStack>
              )}

              {/* Aiming Reticle Overlay */}
              <View style={styles.reticleOverlay} pointerEvents="none">
                <View style={styles.reticleBox} />
              </View>

              {isVerifying ? (
                <Box
                  position="absolute"
                  top={0}
                  left={0}
                  right={0}
                  bottom={0}
                  bg="rgba(5, 9, 20, 0.75)"
                  alignItems="center"
                  justifyContent="center"
                >
                  <ActivityIndicator size="large" color={YELLOW} />
                  <Text color={YELLOW} fontWeight="800" mt="$2">
                    Verifying RS256 Signature...
                  </Text>
                </Box>
              ) : null}
            </Box>

            {activeShiftPrompt ? (
              <Box
                bg="rgba(15, 23, 42, 0.95)"
                borderWidth={2}
                borderColor={YELLOW}
                borderRadius="$xl"
                p="$3.5"
                mt="$3"
              >
                <HStack space="xs" alignItems="center">
                  <AlertCircle size={18} color={YELLOW} />
                  <Heading size="xs" color={YELLOW} fontWeight="900" letterSpacing={0.5}>
                    ACTIVE SHIFT RECONNECTION
                  </Heading>
                </HStack>

                <Text color="#f8fafc" fontSize="$xs" fontWeight="700" mt="$1.5">
                  Operator <Text color={YELLOW} fontWeight="900">{activeShiftPrompt.operator}</Text> (Shift #{activeShiftPrompt.shiftId.slice(0, 8)})
                </Text>

                <Text color="#cbd5e1" fontSize="$xs" mt="$1" lineHeight={18}>
                  {activeShiftPrompt.wasOfflineCheckout
                    ? 'You previously performed an Offline Checkout for this shift.'
                    : 'This shift is currently active on the server.'}
                  {activeShiftPrompt.pendingScansCount > 0
                    ? ` ${activeShiftPrompt.pendingScansCount} local scan record(s) pending transfer.`
                    : ''}
                </Text>

                <Text color={MUTED} fontSize="$2xs" mt="$1">
                  Would you like to complete checkout on the server or resume your shift?
                </Text>

                <VStack space="xs" mt="$3">
                  <HStack space="xs">
                    <Button
                      flex={1}
                      size="sm"
                      variant="outline"
                      borderColor="#ef4444"
                      bg="rgba(239, 68, 68, 0.1)"
                      onPress={handleCompleteServerCheckout}
                      isDisabled={isProcessingCheckout}
                    >
                      {isProcessingCheckout ? (
                        <ActivityIndicator size="small" color="#ef4444" />
                      ) : (
                        <HStack space="xs" alignItems="center">
                          <LogOut size={13} color="#ef4444" />
                          <ButtonText color="#ef4444" fontSize="$xs" fontWeight="900">
                            Check Out
                          </ButtonText>
                        </HStack>
                      )}
                    </Button>

                    <Button
                      flex={1}
                      size="sm"
                      bg={YELLOW}
                      onPress={handleResumeShift}
                      isDisabled={isProcessingCheckout}
                    >
                      <HStack space="xs" alignItems="center">
                        <LogIn size={13} color={BLACK} />
                        <ButtonText color={BLACK} fontSize="$xs" fontWeight="900">
                          Resume & Log In
                        </ButtonText>
                      </HStack>
                    </Button>
                  </HStack>

                  <Button
                    size="xs"
                    variant="outline"
                    borderColor="#475569"
                    onPress={() => setActiveShiftPrompt(null)}
                    isDisabled={isProcessingCheckout}
                  >
                    <ButtonText color="#94a3b8" fontSize="$2xs">
                      Cancel / Scan Other Badge
                    </ButtonText>
                  </Button>
                </VStack>
              </Box>
            ) : null}

            {completedShiftPrompt ? (
              <Box bg="rgba(234, 179, 8, 0.15)" borderWidth={1} borderColor={YELLOW} borderRadius="$xl" p="$3" mt="$3">
                <Text color={YELLOW} fontWeight="900" fontSize="$sm">
                  Shift #{completedShiftPrompt.shiftId.slice(0, 8)} Has Ended
                </Text>
                <Text color="#cbd5e1" fontSize="$xs" mt="$1">
                  Operator {completedShiftPrompt.operator} has already checked out of this shift.
                </Text>
                <HStack space="xs" mt="$3">
                  <Button
                    flex={1}
                    size="sm"
                    variant="outline"
                    borderColor="#64748b"
                    onPress={() => setCompletedShiftPrompt(null)}
                  >
                    <ButtonText color="#cbd5e1">Dismiss</ButtonText>
                  </Button>
                  <Button
                    flex={2}
                    size="sm"
                    bg={YELLOW}
                    onPress={handleStartNewShift}
                    isDisabled={isStartingNewShift}
                  >
                    <ButtonText color={BLACK} fontWeight="900">
                      {isStartingNewShift ? 'Starting...' : 'Start New Shift'}
                    </ButtonText>
                  </Button>
                </HStack>
              </Box>
            ) : null}

            {errorMessage ? (
              <Box bg="rgba(239, 68, 68, 0.15)" borderWidth={1} borderColor={FAIL_COLOR} borderRadius="$md" p="$2" mt="$3">
                <Text color={FAIL_COLOR} fontSize="$xs" fontWeight="700">
                  {errorMessage}
                </Text>
              </Box>
            ) : null}

            {successMessage ? (
              <Box bg="rgba(34, 197, 94, 0.15)" borderWidth={1} borderColor={PASS_COLOR} borderRadius="$md" p="$2" mt="$3">
                <Text color={PASS_COLOR} fontSize="$xs" fontWeight="700">
                  {successMessage}
                </Text>
              </Box>
            ) : null}

            <Text color={MUTED} fontSize="$xs" textAlign="center" mt="$3">
              Aim camera at your physical shift badge or operator QR card
            </Text>
          </Box>
        </VStack>
      </ScrollView>

      {/* Select Key Modal */}
      <Modal
        visible={keyPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setKeyPickerVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setKeyPickerVisible(false)}>
          <Box bg={PANEL} borderWidth={2} borderColor={YELLOW} borderRadius="$xl" p="$4" width="100%" maxWidth={480}>
            <HStack justifyContent="space-between" alignItems="center" mb="$3">
              <Text color={YELLOW} fontSize="$lg" fontWeight="900">
                Select Verification Key
              </Text>
            </HStack>

            {/* Direct Refetch Button Inside Picker Modal */}
            <Button
              variant="outline"
              borderColor={YELLOW}
              size="sm"
              mb="$3"
              onPress={() => handleFetchServerKeys(false)}
              isDisabled={isFetchingServerKeys}
            >
              {isFetchingServerKeys ? (
                <ActivityIndicator size="small" color={YELLOW} />
              ) : (
                <HStack space="xs" alignItems="center">
                  <DownloadCloud size={14} color={YELLOW} />
                  <ButtonText color={YELLOW} fontSize="$xs" fontWeight="800">
                    Refetch Public Keys from Server API
                  </ButtonText>
                </HStack>
              )}
            </Button>

            <ScrollView style={{ maxHeight: 260 }}>
              {publicKeys.length > 0 ? (
                publicKeys.map(k => (
                  <Pressable
                    key={k.id}
                    onPress={() => {
                      setSelectedKeyId(k.id);
                      setKeyPickerVisible(false);
                    }}
                  >
                    <HStack
                      justifyContent="space-between"
                      alignItems="center"
                      borderTopWidth={1}
                      borderTopColor="#334155"
                      py="$3"
                    >
                      <VStack flex={1}>
                        <Text color="#f8fafc" fontWeight="700">
                          {k.name}
                        </Text>
                        <Text color={MUTED} fontSize="$xs">
                          ID: {k.id} · {k.created_at?.slice(0, 10)}
                        </Text>
                      </VStack>
                      {k.id === selectedKey?.id ? (
                        <Text color={YELLOW} fontSize="$xs" fontWeight="900">
                          ACTIVE
                        </Text>
                      ) : null}
                    </HStack>
                  </Pressable>
                ))
              ) : (
                <Text color={MUTED} py="$3" textAlign="center">
                  No public keys saved. Tap &quot;Refetch Public Keys from Server API&quot; above to download them.
                </Text>
              )}
            </ScrollView>
            <Button mt="$3" variant="outline" borderColor="#64748b" onPress={() => setKeyPickerVisible(false)}>
              <ButtonText color="#cbd5e1">Close</ButtonText>
            </Button>
          </Box>
        </Pressable>
      </Modal>

      {/* Add Key Modal */}
      <Modal
        visible={addKeyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddKeyModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Box bg={PANEL} borderWidth={2} borderColor={YELLOW} borderRadius="$xl" p="$4" width="100%" maxWidth={500}>
            <Text color={YELLOW} fontSize="$xl" fontWeight="900" mb="$3">
              Add Public Key (PEM)
            </Text>
            <VStack space="sm">
              <Input variant="outline" size="md" borderColor="#334155">
                <InputField
                  value={newKeyName}
                  onChangeText={setNewKeyName}
                  placeholder="Key alias (e.g. Master Shift Key)"
                  placeholderTextColor="#64748b"
                  color="#f8fafc"
                />
              </Input>

              <Input variant="outline" size="md" borderColor="#334155">
                <InputField
                  value={newKeyPem}
                  onChangeText={setNewKeyPem}
                  placeholder="Paste PEM (-----BEGIN PUBLIC KEY----- ...)"
                  placeholderTextColor="#64748b"
                  color="#f8fafc"
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  minHeight={110}
                />
              </Input>

              <HStack space="sm" justifyContent="flex-end" mt="$2">
                <Button variant="outline" borderColor="#64748b" onPress={() => setAddKeyModalVisible(false)}>
                  <ButtonText color="#cbd5e1">Cancel</ButtonText>
                </Button>
                <Button bg={YELLOW} onPress={handleSaveManualKey}>
                  <ButtonText color={BLACK} fontWeight="900">
                    Save Key
                  </ButtonText>
                </Button>
              </HStack>
            </VStack>
          </Box>
        </View>
      </Modal>

      {/* Server API URL Modal */}
      <Modal
        visible={serverModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setServerModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Box bg={PANEL} borderWidth={2} borderColor={YELLOW} borderRadius="$xl" p="$4" width="100%" maxWidth={480}>
            <Text color={YELLOW} fontSize="$lg" fontWeight="900" mb="$2">
              Configure Backend Server API
            </Text>
            <Text color={MUTED} fontSize="$xs" mb="$3">
              Set the backend API host (e.g. http://10.0.2.2:8000 for Android emulator or http://192.168.1.50:8000 for physical device)
            </Text>
            <Input variant="outline" size="md" borderColor="#334155" mb="$3">
              <InputField
                value={serverUrlInput}
                onChangeText={setServerUrlInput}
                placeholder="http://10.0.2.2:8000"
                placeholderTextColor="#64748b"
                color="#f8fafc"
              />
            </Input>
            <HStack space="sm" justifyContent="flex-end">
              <Button variant="outline" borderColor="#64748b" onPress={() => setServerModalVisible(false)}>
                <ButtonText color="#cbd5e1">Cancel</ButtonText>
              </Button>
              <Button
                bg={YELLOW}
                onPress={async () => {
                  await setApiBaseUrl(serverUrlInput);
                  setServerModalVisible(false);
                  await handleFetchServerKeys(false);
                }}
              >
                <ButtonText color={BLACK} fontWeight="900">
                  Save & Refetch
                </ButtonText>
              </Button>
            </HStack>
          </Box>
        </View>
      </Modal>
    </Box>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  reticleOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleBox: {
    width: 170,
    height: 170,
    borderWidth: 2,
    borderColor: YELLOW,
    borderRadius: 16,
    borderStyle: 'dashed',
  },
  refreshBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(250, 204, 21, 0.12)',
    borderWidth: 1,
    borderColor: YELLOW,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
});
