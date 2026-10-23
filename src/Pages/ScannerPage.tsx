import type { PermissionResponse } from 'expo';
import type { BarcodeScanningResult } from 'expo-camera';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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

import { addScanToQueue, getInventoryItems, getPublicKeys, initDatabase } from '@/core/db';
import { verifyJwtAgainstPublicKey } from '@/core/jwt';
import { InventoryRecord, PublicKeyRecord, UiMode, VerificationResult } from '@/core/types';

const PASS_COLOR = '#22c55e';
const FAIL_COLOR = '#ef4444';
const YELLOW = '#facc15';
const BLACK = '#0f172a';
const PANEL = '#111827';

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

export default function ScannerPage() {
  const [uiMode, setUiMode] = useState<UiMode>('PASS_FAIL_MODE');
  const [permission, setPermission] = useState<PermissionResponse | null>(null);
  const [publicKeys, setPublicKeys] = useState<PublicKeyRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [scanValue, setScanValue] = useState('');
  const [statusMessage, setStatusMessage] = useState('Ready for scan');
  const [cameraActive, setCameraActive] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [keyPickerVisible, setKeyPickerVisible] = useState(false);
  const scanLocked = useRef(false);

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
        keys.forEach((key) => {
          const raw = key.public_key_string ?? '';
          const sanitized = raw.replace(/\r/g, '').trim();
          console.log('DB_PUBLIC_KEY_START');
          console.log('KEY_ID', key.id);
          console.log('KEY_NAME', key.name);
          console.log('RAW_PUBLIC_KEY');
          console.log(raw);
          console.log('RAW_PUBLIC_KEY_END');
          console.log('SANITIZED_PUBLIC_KEY');
          console.log(sanitized);
          console.log('SANITIZED_PUBLIC_KEY_END');
          console.log('PUBLIC_KEY_LENGTH', raw.length);
          console.log('HAS_BEGIN', raw.includes('-----BEGIN'));
          console.log('HAS_END', raw.includes('-----END'));
        });
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
    setScanValue('');
    setHasScanned(false);
    setCameraActive(true);
    setStatusMessage('Point the camera at a JWT QR code');
  };

  const handleBarcodeScanned = async ({ data }: BarcodeScanningResult) => {
    if (scanLocked.current) return;
    scanLocked.current = true;
    setCameraActive(false);
    setHasScanned(true);

    const jwt = extractJwt(data)?.trim() ?? null;
    setScanValue(jwt ?? data.trim());

    if (!jwt) {
      const failure: VerificationResult = {
        valid: false,
        status: 'fail',
        reason: 'QR code does not contain a valid JWT',
      };
      setResult(failure);
      setStatusMessage(failure.reason);
      await addScanToQueue(data, 'fail');
      await triggerHaptics('error');
      return;
    }

    if (!selectedKey) {
      const failure: VerificationResult = {
        valid: false,
        status: 'fail',
        reason: 'No public key selected',
      };
      setResult(failure);
      setStatusMessage(failure.reason);
      await addScanToQueue(jwt, 'fail');
      await triggerHaptics('error');
      return;
    }

    setIsVerifying(true);
    try {
      const inventoryMatch = inventory[0];
      const rawKey = selectedKey.public_key_string;
      const sanitized = rawKey.replace(/\r/g, '').trim();
      console.log('VERIFY DEBUG:', {
        selectedKeyId: selectedKey.id,
        selectedKeyName: selectedKey.name,
        rawLength: rawKey.length,
        sanitizedLength: sanitized.length,
        hasBegin: sanitized.includes('-----BEGIN'),
        hasEnd: sanitized.includes('-----END'),
        preview: sanitized.slice(0, 220),
        jwtPreview: jwt.slice(0, 120),
      });
      const verification = await verifyJwtAgainstPublicKey(
        jwt,
        selectedKey.public_key_string,
        inventoryMatch?.matching_claim_key,
        inventoryMatch?.expected_value,
      );

      setResult(verification);
      setStatusMessage(verification.reason);
      await addScanToQueue(jwt, verification.status);
      await triggerHaptics(verification.status === 'pass' ? 'success' : 'error');
    } catch {
      const failure: VerificationResult = {
        valid: false,
        status: 'fail',
        reason: 'Could not verify or save this scan',
      };
      setResult(failure);
      setStatusMessage(failure.reason);
      await triggerHaptics('error');
    } finally {
      setIsVerifying(false);
    }
  };

  const resultColor = result?.status === 'pass' ? PASS_COLOR : FAIL_COLOR;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>VeriFlow</Text>
        <Text style={styles.subtitle}>Industrial JWT Scanner</Text>
      </View>

      <View style={styles.tabsRow}>
        <Pressable
          style={[styles.tabButton, uiMode === 'PASS_FAIL_MODE' && styles.tabButtonActive]}
          onPress={() => setUiMode('PASS_FAIL_MODE')}>
          <Text style={[styles.tabText, uiMode === 'PASS_FAIL_MODE' && styles.tabTextActive]}>Pass / Fail</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, uiMode === 'DATA_MODE' && styles.tabButtonActive]}
          onPress={() => setUiMode('DATA_MODE')}>
          <Text style={[styles.tabText, uiMode === 'DATA_MODE' && styles.tabTextActive]}>Data</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Verification key</Text>
        <Pressable style={styles.pickerBox} onPress={openKeyPicker} accessibilityRole="button">
          <Text style={styles.pickerText}>{selectedKey ? selectedKey.name : 'Choose a public key'}</Text>
          <Text style={styles.pickerChevron}>⌄</Text>
        </Pressable>

        <Text style={styles.label}>QR scanner</Text>
        <View style={styles.cameraFrame}>
          {cameraActive && permission?.granted && !hasScanned && CameraView ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcodeScanned}
              onMountError={() => setStatusMessage('Could not start the camera')}
            />
          ) : (
            <View style={styles.cameraMessage}>
              <Text style={styles.cameraMessageTitle}>
                {hasScanned ? 'QR code captured' : CameraView ? 'Camera ready' : 'Camera unavailable'}
              </Text>
              <Text style={styles.cameraMessageText}>
                {hasScanned
                  ? 'Review the verification result below.'
                  : CameraView
                    ? 'Scan a QR code containing a JWT.'
                    : 'Rebuild the Android app to enable QR scanning.'}
              </Text>
            </View>
          )}
        </View>

        <Pressable
          style={[styles.scanButton, isVerifying && styles.scanButtonDisabled]}
          onPress={startCamera}
          disabled={isVerifying || !CameraView}>
          <Text style={styles.scanButtonText}>
            {isVerifying ? 'Verifying...' : hasScanned ? 'Scan another QR' : 'Start QR scanner'}
          </Text>
        </Pressable>

        <Text style={styles.scanStatus}>{statusMessage}</Text>

        {scanValue ? (
          <View style={styles.jwtBox}>
            <Text style={styles.label}>Scanned JWT</Text>
            <Text style={styles.jwtText} numberOfLines={3}>{scanValue}</Text>
          </View>
        ) : null}
      </View>

      {uiMode === 'PASS_FAIL_MODE' ? (
        <View style={[styles.resultBox, { backgroundColor: result ? resultColor : PANEL, borderColor: YELLOW }]}>
          <Text style={styles.resultText}>{result ? (result.status === 'pass' ? 'PASS' : 'FAIL') : 'READY'}</Text>
          <Text style={styles.resultSubText}>{result ? result.reason : statusMessage}</Text>
        </View>
      ) : (
        <ScrollView style={styles.payloadPanel}>
          <Text style={styles.payloadTitle}>Decoded payload</Text>
          <Text style={styles.payloadText}>
            {result?.payload ? JSON.stringify(result.payload, null, 2) : '{\n  "status": "waiting for scan"\n}'}
          </Text>
        </ScrollView>
      )}

      <Modal
        visible={keyPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setKeyPickerVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setKeyPickerVisible(false)}>
          <View style={styles.keyPickerModal}>
            <Text style={styles.keyPickerTitle}>Select public key</Text>
            {publicKeys.length ? publicKeys.map(key => (
              <Pressable
                key={key.id}
                style={styles.keyOption}
                onPress={() => {
                  setSelectedKeyId(key.id);
                  setResult(null);
                  setStatusMessage('Ready for scan');
                  setKeyPickerVisible(false);
                }}>
                <Text style={styles.keyOptionText}>{key.name}</Text>
                {key.id === selectedKeyId ? <Text style={styles.keySelected}>SELECTED</Text> : null}
              </Pressable>
            )) : (
              <Text style={styles.emptyKeysText}>No public keys found. Add one in Settings.</Text>
            )}
            <Pressable style={styles.modalCloseButton} onPress={() => setKeyPickerVisible(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BLACK,
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    color: YELLOW,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 1,
  },
  subtitle: {
    color: '#e5e7eb',
    fontSize: 14,
    marginTop: 6,
  },
  tabsRow: {
    flexDirection: 'row',
    marginBottom: 18,
    borderWidth: 2,
    borderColor: YELLOW,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#0b1120',
  },
  tabButtonActive: {
    backgroundColor: YELLOW,
  },
  tabText: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 15,
  },
  tabTextActive: {
    color: BLACK,
  },
  card: {
    backgroundColor: PANEL,
    borderWidth: 2,
    borderColor: YELLOW,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  label: {
    color: '#f8fafc',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  pickerBox: {
    backgroundColor: '#0b1120',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerText: {
    color: '#f8fafc',
    fontSize: 16,
  },
  jwtBox: {
    backgroundColor: '#0b1120',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    padding: 12,
    minHeight: 76,
    marginBottom: 16,
  },
  pickerChevron: {
    color: YELLOW,
    fontSize: 22,
    lineHeight: 22,
  },
  cameraFrame: {
    height: 220,
    overflow: 'hidden',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: '#050914',
    marginBottom: 14,
  },
  cameraMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  cameraMessageTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  cameraMessageText: {
    color: '#cbd5e1',
    textAlign: 'center',
    fontSize: 13,
  },
  scanStatus: {
    color: '#cbd5e1',
    fontSize: 13,
    marginBottom: 12,
  },
  jwtText: {
    color: '#dbeafe',
    fontSize: 12,
    lineHeight: 18,
  },
  scanButton: {
    minHeight: 56,
    backgroundColor: YELLOW,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButtonText: {
    color: BLACK,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  scanButtonDisabled: {
    opacity: 0.55,
  },
  resultBox: {
    flex: 1,
    borderWidth: 3,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    minHeight: 220,
  },
  resultText: {
    color: '#f8fafc',
    fontWeight: '900',
    fontSize: 42,
    letterSpacing: 2,
  },
  resultSubText: {
    color: '#f8fafc',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 15,
  },
  payloadPanel: {
    flex: 1,
    backgroundColor: PANEL,
    borderWidth: 2,
    borderColor: YELLOW,
    borderRadius: 16,
    padding: 16,
  },
  payloadTitle: {
    color: YELLOW,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  payloadText: {
    color: '#e2e8f0',
    fontSize: 12,
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  keyPickerModal: {
    backgroundColor: PANEL,
    borderWidth: 2,
    borderColor: YELLOW,
    borderRadius: 12,
    padding: 16,
  },
  keyPickerTitle: {
    color: YELLOW,
    fontWeight: '900',
    fontSize: 18,
    marginBottom: 12,
  },
  keyOption: {
    minHeight: 52,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  keyOptionText: {
    color: '#f8fafc',
    fontSize: 15,
    flexShrink: 1,
  },
  keySelected: {
    color: YELLOW,
    fontSize: 10,
    fontWeight: '900',
  },
  emptyKeysText: {
    color: '#cbd5e1',
    paddingVertical: 12,
  },
  modalCloseButton: {
    alignSelf: 'flex-end',
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginTop: 8,
  },
  modalCloseText: {
    color: YELLOW,
    fontWeight: '800',
  },
});
