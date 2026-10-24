import {
    Box,
    Button,
    ButtonText,
    HStack,
    Heading,
    Pressable,
    ScrollView,
    Text,
    VStack,
} from '@gluestack-ui/themed';
import type { PermissionResponse } from 'expo';
import type { BarcodeScanningResult } from 'expo-camera';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Platform, StyleSheet, useWindowDimensions } from 'react-native';

type CameraModuleType = typeof import('expo-camera');
let cameraModule: CameraModuleType | null = null;

try {
  cameraModule = require('expo-camera');
} catch {
  cameraModule = null;
}

const CameraView = cameraModule?.CameraView;

let Haptics: any = null;
try {
  Haptics = require('expo-haptics');
} catch {
  Haptics = null;
}

import { addScanHistory, addScanToQueue, getInventoryItems, getPublicKeys, initDatabase } from '@/core/db';
import { verifyJwtAgainstPublicKey } from '@/core/jwt';
import { InventoryRecord, PublicKeyRecord, UiMode, VerificationResult } from '@/core/types';

const PASS_COLOR = '#22c55e';
const FAIL_COLOR = '#ef4444';
const YELLOW = '#facc15';
const BLACK = '#07111d';
const PANEL = '#0f172a';
const PANEL_ALT = '#0b1220';
const SCAN_NOTIFICATION_CHANNEL = 'scan-results';

type NotificationsModule = typeof import('expo-notifications');
let notificationsModule: NotificationsModule | null = null;

try {
  const loadedNotifications: NotificationsModule = require('expo-notifications');
  loadedNotifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  notificationsModule = loadedNotifications;
} catch {
  notificationsModule = null;
}

async function notifyScanResult(result: VerificationResult) {
  if (!notificationsModule) return;

  try {
    if (Platform.OS === 'android') {
      await notificationsModule.setNotificationChannelAsync(SCAN_NOTIFICATION_CHANNEL, {
        name: 'Scan results',
        importance: notificationsModule.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 150, 250],
        lightColor: YELLOW,
      });
    }

    let permission = await notificationsModule.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) {
      permission = await notificationsModule.requestPermissionsAsync();
    }
    if (!permission.granted) return;

    await notificationsModule.scheduleNotificationAsync({
      content: {
        title: result.status === 'pass' ? 'Verification passed' : 'Verification failed',
        body: result.reason,
        sound: true,
        data: { status: result.status },
      },
      trigger: Platform.OS === 'android' ? { channelId: SCAN_NOTIFICATION_CHANNEL } : null,
    });
  } catch {
    return;
  }
}

function extractJwt(value: string): string | null {
  let candidate = value.trim();

  try {
    const url = new URL(candidate);
    candidate = url.searchParams.get('jwt') ?? url.searchParams.get('token') ?? candidate;
  } catch {
    // Raw JWT QR codes are not URLs.
  }

  candidate = candidate.trim();
  const segments = candidate.split('.');
  return segments.length === 3 && segments.every(Boolean) ? candidate : null;
}

function serializeScanData(scannedValue: string, payload?: Record<string, any>): string {
  if (payload) return JSON.stringify(payload);

  try {
    return JSON.stringify(JSON.parse(scannedValue));
  } catch {
    return JSON.stringify({ scannedValue });
  }
}

export default function ScannerPage() {
  const { height } = useWindowDimensions();
  const cameraPreviewHeight = Math.max(112, Math.min(190, Math.round(height * 0.17)));
  const [uiMode, setUiMode] = useState<UiMode>('PASS_FAIL_MODE');
  const [permission, setPermission] = useState<PermissionResponse | null>(null);
  const [publicKeys, setPublicKeys] = useState<PublicKeyRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [splashResult, setSplashResult] = useState<VerificationResult | null>(null);
  const [toastResult, setToastResult] = useState<VerificationResult | null>(null);
  const [statusMessage, setStatusMessage] = useState('Ready for scan');
  const [cameraActive, setCameraActive] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [keyPickerVisible, setKeyPickerVisible] = useState(false);
  const scanLocked = useRef(false);
  const uiModeRef = useRef<UiMode>('PASS_FAIL_MODE');

  useEffect(() => {
    if (!cameraModule) {
      setStatusMessage('Camera module is missing from this app build. Rebuild to enable QR scanning.');
      return;
    }

    cameraModule.Camera.getCameraPermissionsAsync()
      .then(setPermission)
      .catch(() => setStatusMessage('Could not check camera permission'));
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        await initDatabase();
        const [keys, items] = await Promise.all([getPublicKeys(), getInventoryItems()]);
        setPublicKeys(keys);
        setInventory(items);
        if (keys.length > 0) setSelectedKeyId(keys[0].id);
      } catch {
        setStatusMessage('Could not load scanner settings');
      }
    };

    loadData();
  }, []);

  const selectedKey = useMemo(
    () => publicKeys.find(key => key.id === selectedKeyId) ?? null,
    [publicKeys, selectedKeyId],
  );

  const presentOutcome = (outcome: VerificationResult) => {
    setResult(outcome);
    if (uiModeRef.current === 'PASS_FAIL_MODE') {
      setStatusMessage(outcome.reason);
      setSplashResult(outcome);
      setToastResult(null);
      void notifyScanResult(outcome);
    } else {
      setStatusMessage(outcome.payload ? 'Scan complete. Review the decoded payload.' : 'Scan complete. No payload available.');
    }
  };

  const changeUiMode = (mode: UiMode) => {
    uiModeRef.current = mode;
    setUiMode(mode);
  };

  useEffect(() => {
    if (uiMode === 'DATA_MODE') {
      setSplashResult(null);
      setToastResult(null);
    }
  }, [uiMode]);

  useEffect(() => {
    if (!splashResult) return;

    const timeout = setTimeout(() => {
      setSplashResult(null);
      setToastResult(splashResult);
      setStatusMessage('Ready for scan');
    }, 5500);

    return () => clearTimeout(timeout);
  }, [splashResult]);

  useEffect(() => {
    if (!toastResult) return;

    const timeout = setTimeout(() => setToastResult(null), 4000);
    return () => clearTimeout(timeout);
  }, [toastResult]);

  const triggerHaptics = async (type: 'success' | 'error') => {
    if (!Haptics || !Haptics.notificationAsync) {
      return;
    }

    try {
      const feedbackType = type === 'success'
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error;
      await Haptics.notificationAsync(feedbackType);
    } catch {
      return;
    }
  };

  const openKeyPicker = async () => {
    try {
      await initDatabase();
      const keys = await getPublicKeys();
      setPublicKeys(keys);
      if (!keys.some(key => key.id === selectedKeyId)) {
        setSelectedKeyId(keys[0]?.id ?? null);
      }
      setKeyPickerVisible(true);
    } catch {
      setStatusMessage('Could not load public keys');
    }
  };

  const startCamera = async () => {
    if (!cameraModule) {
      setStatusMessage('Camera module is missing from this app build. Rebuild to enable QR scanning.');
      return;
    }

    if (!permission?.granted) {
      const response = await cameraModule.Camera.requestCameraPermissionsAsync();
      setPermission(response);
      if (!response.granted) {
        setStatusMessage('Camera permission is required to scan QR codes');
        return;
      }
    }

    scanLocked.current = false;
    setResult(null);
    setHasScanned(false);
    setCameraActive(true);
    setStatusMessage('Point the camera at a signed QR code');
  };

  const handleBarcodeScanned = async ({ data }: BarcodeScanningResult) => {
    if (scanLocked.current) return;
    scanLocked.current = true;
    setCameraActive(false);
    setHasScanned(true);

    const jwt = extractJwt(data)?.trim() ?? null;

    if (!jwt) {
      const failure: VerificationResult = {
        valid: false,
        status: 'fail',
        reason: 'QR code does not contain valid signed data',
      };
      presentOutcome(failure);
      await addScanToQueue(data, 'fail');
      await addScanHistory(data, serializeScanData(data), 'fail', failure.reason, null);
      await triggerHaptics('error');
      return;
    }

    if (!selectedKey) {
      const failure: VerificationResult = {
        valid: false,
        status: 'fail',
        reason: 'No public key selected',
      };
      presentOutcome(failure);
      await addScanToQueue(jwt, 'fail');
      await addScanHistory(data, serializeScanData(data), 'fail', failure.reason, null);
      await triggerHaptics('error');
      return;
    }

    setIsVerifying(true);
    try {
      const inventoryMatch = inventory[0];
      const verification = await verifyJwtAgainstPublicKey(
        jwt,
        selectedKey.public_key_string,
        inventoryMatch?.matching_claim_key,
        inventoryMatch?.expected_value,
      );

      presentOutcome(verification);
      await addScanToQueue(jwt, verification.status);
      await addScanHistory(
        data,
        serializeScanData(data, verification.payload),
        verification.status,
        verification.reason,
        selectedKey.name,
      );
      await triggerHaptics(verification.status === 'pass' ? 'success' : 'error');
    } catch {
      const failure: VerificationResult = {
        valid: false,
        status: 'fail',
        reason: 'Could not verify or save this scan',
      };
      presentOutcome(failure);
      await addScanHistory(data, serializeScanData(data), 'fail', failure.reason, selectedKey.name);
      await triggerHaptics('error');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Box flex={1} bg={BLACK} px="$4" pt="$2" pb="$2">
      <VStack space="sm" flex={1}>
        <HStack alignItems="center" space="sm">
          <Image
            source={require('../assets/msi_white.png')}
            style={{ width: 48, height: 42 }}
            resizeMode="contain"
            accessibilityLabel="VeriFlow logo"
          />
          <VStack space="xs" flex={1}>
            <Heading size="lg" color={YELLOW} fontWeight="900">
              VeriFlow
            </Heading>
            <Text color="#e2e8f0" fontSize="$xs">
              Industrial Offline Scanner
            </Text>
          </VStack>
        </HStack>

        <Box bg={PANEL} borderWidth={2} borderColor={YELLOW} borderRadius="$xl" p="$2">
          <HStack bg={PANEL_ALT} borderRadius="$lg" overflow="hidden" borderWidth={1} borderColor={YELLOW}>
            <Pressable
              flex={1}
              py="$2"
              alignItems="center"
              bg={uiMode === 'PASS_FAIL_MODE' ? YELLOW : PANEL_ALT}
              onPress={() => changeUiMode('PASS_FAIL_MODE')}
            >
              <Text color={uiMode === 'PASS_FAIL_MODE' ? BLACK : '#f8fafc'} fontWeight="800">
                Pass / Fail
              </Text>
            </Pressable>
            <Pressable
              flex={1}
              py="$2"
              alignItems="center"
              bg={uiMode === 'DATA_MODE' ? YELLOW : PANEL_ALT}
              onPress={() => changeUiMode('DATA_MODE')}
            >
              <Text color={uiMode === 'DATA_MODE' ? BLACK : '#f8fafc'} fontWeight="800">
                Data
              </Text>
            </Pressable>
          </HStack>
        </Box>

        <Box bg={PANEL} borderWidth={2} borderColor={YELLOW} borderRadius="$xl" p="$3">
          <Text color="#f8fafc" fontSize="$xs" fontWeight="800" letterSpacing={1} mb="$1">
            Verification key
          </Text>

          <Pressable onPress={openKeyPicker}>
            <Box
              bg={PANEL_ALT}
              borderWidth={1}
              borderColor="#334155"
              borderRadius="$lg"
              px="$3"
              py="$2"
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Text color="#f8fafc" fontSize="$md" fontWeight="700" numberOfLines={1} flex={1}>
                {selectedKey ? selectedKey.name : 'Choose a public key'}
              </Text>
              <Text color={YELLOW} fontSize="$2xl" fontWeight="900">
                ⌄
              </Text>
            </Box>
          </Pressable>

          <Text color="#f8fafc" fontSize="$xs" fontWeight="800" letterSpacing={1} mt="$2" mb="$1">
            QR scanner
          </Text>

          <Box h={cameraPreviewHeight} borderWidth={2} borderColor={YELLOW} borderRadius="$xl" overflow="hidden" bg="#050914">
            {cameraActive && permission?.granted && !hasScanned && CameraView ? (
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleBarcodeScanned}
                onMountError={() => setStatusMessage('Could not start the camera')}
              />
            ) : (
              <VStack flex={1} alignItems="center" justifyContent="center" px="$4">
                <Text color="#f8fafc" fontSize="$xl" fontWeight="900" textAlign="center">
                  {hasScanned ? 'QR code captured' : CameraView ? 'Camera ready' : 'Camera unavailable'}
                </Text>
                <Text color="#cbd5e1" fontSize="$sm" textAlign="center" mt="$2">
                  {hasScanned
                    ? 'Review the verification result below.'
                    : CameraView
                      ? 'Scan a signed QR code.'
                      : 'Rebuild the Android app to enable QR scanning.'}
                </Text>
              </VStack>
            )}
          </Box>

          <Button
            mt="$2"
            bg={YELLOW}
            borderRadius="$lg"
            onPress={startCamera}
            isDisabled={isVerifying || !CameraView}
          >
            <ButtonText color={BLACK} fontWeight="900">
              {isVerifying ? 'Verifying...' : hasScanned ? 'Scan another QR' : 'Start QR scanner'}
            </ButtonText>
          </Button>

          <Text color="#dbeafe" fontSize="$xs" mt="$2" numberOfLines={2}>
            {statusMessage}
          </Text>
        </Box>

        {uiMode === 'PASS_FAIL_MODE' ? (
          <Box
            bg={PANEL}
            borderWidth={3}
            borderColor={YELLOW}
            borderRadius="$2xl"
            minHeight={96}
            maxHeight={136}
            p="$3"
            alignItems="center"
            justifyContent="center"
          >
            <Text color={YELLOW} fontSize="$3xl" fontWeight="900" letterSpacing={2}>
              READY
            </Text>
            <Text color="#cbd5e1" fontSize="$md" textAlign="center" mt="$2">
              Awaiting scan result
            </Text>
          </Box>
        ) : (
          <Box bg={PANEL} borderWidth={2} borderColor={YELLOW} borderRadius="$xl" p="$3" flex={1} minHeight={0}>
            <Text color={YELLOW} fontSize="$lg" fontWeight="800" mb="$2">
              Decoded payload
            </Text>
            <ScrollView flex={1}>
              <Text color="#e2e8f0" fontSize="$xs" lineHeight={20}>
                {result?.payload ? JSON.stringify(result.payload, null, 2) : '{\n  "status": "waiting for scan"\n}'}
              </Text>
            </ScrollView>
          </Box>
        )}
      </VStack>

      {toastResult && uiMode === 'PASS_FAIL_MODE' ? (
        <Pressable style={styles.toast} onPress={() => setToastResult(null)}>
          <Box
            bg={PANEL}
            borderWidth={2}
            borderColor={toastResult.status === 'pass' ? PASS_COLOR : FAIL_COLOR}
            borderRadius="$lg"
            px="$4"
            py="$3"
          >
            <HStack justifyContent="space-between" alignItems="center" space="md">
              <Text color={toastResult.status === 'pass' ? PASS_COLOR : FAIL_COLOR} fontWeight="900">
                {toastResult.status === 'pass' ? 'PASS' : 'FAIL'}
              </Text>
              <Text color="#f8fafc" flex={1} numberOfLines={2}>
                {toastResult.reason}
              </Text>
              <Text color="#cbd5e1" fontSize="$lg">×</Text>
            </HStack>
          </Box>
        </Pressable>
      ) : null}

      <Modal
        visible={keyPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setKeyPickerVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setKeyPickerVisible(false)}>
          <Box bg={PANEL} borderWidth={2} borderColor={YELLOW} borderRadius="$xl" p="$4">
            <Text color={YELLOW} fontSize="$xl" fontWeight="900" mb="$3">
              Select public key
            </Text>

            {publicKeys.length ? publicKeys.map(key => (
              <Pressable
                key={key.id}
                onPress={() => {
                  setSelectedKeyId(key.id);
                  setResult(null);
                  setStatusMessage('Ready for scan');
                  setKeyPickerVisible(false);
                }}
              >
                <HStack justifyContent="space-between" alignItems="center" borderTopWidth={1} borderTopColor="#334155" py="$3">
                  <Text color="#f8fafc" fontSize="$md" flexShrink={1}>
                    {key.name}
                  </Text>
                  {key.id === selectedKeyId ? (
                    <Text color={YELLOW} fontSize="$xs" fontWeight="900">
                      SELECTED
                    </Text>
                  ) : null}
                </HStack>
              </Pressable>
            )) : (
              <Text color="#cbd5e1" py="$3">
                No public keys found. Add one in Settings.
              </Text>
            )}

            <Button variant="link" mt="$2" onPress={() => setKeyPickerVisible(false)}>
              <ButtonText color={YELLOW}>Close</ButtonText>
            </Button>
          </Box>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(splashResult && uiMode === 'PASS_FAIL_MODE')}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => undefined}
      >
        {splashResult ? (
          <Box
            flex={1}
            bg={splashResult.status === 'pass' ? PASS_COLOR : FAIL_COLOR}
            alignItems="center"
            justifyContent="center"
            px="$6"
          >
            <Text color="#ffffff" fontSize="$6xl" fontWeight="900" textAlign="center">
              {splashResult.status === 'pass' ? 'PASS' : 'FAIL'}
            </Text>
            <Text color="#ffffff" fontSize="$xl" fontWeight="800" textAlign="center" mt="$3">
              {splashResult.status === 'pass' ? 'THIS VERIFICATION PASSED' : 'THIS VERIFICATION FAILED'}
            </Text>
            <Text color="#ffffff" fontSize="$md" textAlign="center" mt="$4">
              {splashResult.reason}
            </Text>
          </Box>
        ) : null}
      </Modal>
    </Box>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  toast: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    zIndex: 100,
    elevation: 12,
  },
});
