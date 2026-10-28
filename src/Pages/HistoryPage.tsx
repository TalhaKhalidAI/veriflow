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
import { ShieldAlert, Trash2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, StyleSheet, View } from 'react-native';
import { useAuth } from '../core/authContext';
import { deleteScan, getAllScans, updateScanStatus } from '../core/db';
import { ScanRecord } from '../core/types';

const BLACK = '#07111d';
const PANEL = '#0f172a';
const PANEL_ALT = '#111c2e';
const YELLOW = '#facc15';
const MUTED = '#94a3b8';
const PASS_COLOR = '#22c55e';
const FAIL_COLOR = '#ef4444';

export default function HistoryPage() {
  const { session, hasPermission } = useAuth();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [selectedScan, setSelectedScan] = useState<ScanRecord | null>(null);

  const canViewAny = hasPermission('scans.view.any') || session?.role === 'admin';
  const canViewOwn = hasPermission('scans.view.own') || hasPermission('scans.view');
  const canView = canViewAny || canViewOwn;
  const canUpdate = hasPermission('scans.update');
  const canDelete = hasPermission('scans.delete');

  const loadData = async () => {
    if (!canView) return;
    try {
      // Scoped to current user's ID unless user is admin or has scans.view.any
      const records = await getAllScans(canViewAny ? undefined : session?.userId);
      setScans(records);
    } catch (e) {
      console.warn('Failed loading history:', e);
    }
  };

  useEffect(() => {
    void loadData();
  }, [canView, session?.userId]);

  if (!canView) {
    return (
      <Box flex={1} bg={BLACK} p="$6" alignItems="center" justifyContent="center">
        <ShieldAlert size={64} color="#f87171" />
        <Heading color="#f87171" size="xl" mt="$4" textAlign="center">
          Permission Restricted
        </Heading>
        <Text color={MUTED} textAlign="center" mt="$2" maxWidth={360}>
          Your current shift token does not contain the required <Text color={YELLOW} fontWeight="700">scans.view</Text> permission.
        </Text>
      </Box>
    );
  }

  const handleDelete = (item: ScanRecord) => {
    if (!canDelete) {
      Alert.alert('Permission Denied', 'Your token lacks "scans.delete" permission.');
      return;
    }
    Alert.alert('Delete Scan Record?', `Record #${item.id} will be permanently removed from this device.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteScan(item.id);
          await loadData();
        },
      },
    ]);
  };

  const handleToggleStatus = async (item: ScanRecord) => {
    if (!canUpdate) {
      Alert.alert('Permission Denied', 'Your token lacks "scans.update" permission.');
      return;
    }
    const nextStatus = item.status === 'pass' ? 'fail' : 'pass';
    await updateScanStatus(item.id, nextStatus);
    await loadData();
  };

  const total = scans.length;
  const passCount = scans.filter(s => s.status === 'pass').length;
  const pendingCount = scans.filter(s => s.sync_status === 'pending').length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BLACK }}>
      <Box px="$4" py="$6">
        <VStack space="lg" width="100%" maxWidth={600} alignSelf="center">
          <HStack justifyContent="space-between" alignItems="center">
            <VStack>
              <Heading color={YELLOW} size="2xl" fontWeight="900">
                Scan Audit Log
              </Heading>
              <Text color={MUTED} fontSize="$xs">
                Local verification history & queue
              </Text>
            </VStack>
            <Pressable onPress={loadData} style={styles.iconBtn}>
              <RefreshCw size={20} color={YELLOW} />
            </Pressable>
          </HStack>

          {/* Stats Bar */}
          <HStack space="sm">
            <Box flex={1} bg={PANEL} p="$3" borderRadius="$lg" borderWidth={1} borderColor="#334155">
              <Text color={MUTED} fontSize="$xs">TOTAL</Text>
              <Text color="#f8fafc" fontSize="$xl" fontWeight="900">{total}</Text>
            </Box>
            <Box flex={1} bg={PANEL} p="$3" borderRadius="$lg" borderWidth={1} borderColor="#334155">
              <Text color={MUTED} fontSize="$xs">PASSED</Text>
              <Text color={PASS_COLOR} fontSize="$xl" fontWeight="900">{passCount}</Text>
            </Box>
            <Box flex={1} bg={PANEL} p="$3" borderRadius="$lg" borderWidth={1} borderColor="#334155">
              <Text color={MUTED} fontSize="$xs">PENDING SYNC</Text>
              <Text color={YELLOW} fontSize="$xl" fontWeight="900">{pendingCount}</Text>
            </Box>
          </HStack>

          {/* Permissions Status Pill */}
          <Box bg={PANEL_ALT} p="$3" borderRadius="$md" borderWidth={1} borderColor="#334155">
            <Text color={MUTED} fontSize="$xs" fontWeight="700" mb="$1">ACTIVE PERMISSIONS FOR THIS SCREEN:</Text>
            <HStack space="md" flexWrap="wrap">
              <Text color={canView ? PASS_COLOR : FAIL_COLOR} fontSize="$xs">
                • scans.view: {canView ? (canViewAny ? 'GRANTED (ALL)' : `GRANTED (USER #${session?.userId})`) : 'DENIED'}
              </Text>
              <Text color={canUpdate ? PASS_COLOR : FAIL_COLOR} fontSize="$xs">
                • scans.update: {canUpdate ? 'GRANTED' : 'DENIED'}
              </Text>
              <Text color={canDelete ? PASS_COLOR : FAIL_COLOR} fontSize="$xs">
                • scans.delete: {canDelete ? 'GRANTED' : 'DENIED'}
              </Text>
            </HStack>
          </Box>

          {/* Scan Items List */}
          <VStack space="sm">
            {scans.length > 0 ? (
              scans.map(item => (
                <Box
                  key={item.id}
                  bg={PANEL}
                  borderWidth={1}
                  borderColor={item.status === 'pass' ? '#166534' : '#991b1b'}
                  borderRadius="$lg"
                  p="$3"
                >
                  <HStack justifyContent="space-between" alignItems="flex-start">
                    <HStack space="sm" alignItems="center">
                      {item.status === 'pass' ? (
                        <CheckCircle2 size={20} color={PASS_COLOR} />
                      ) : (
                        <XCircle size={20} color={FAIL_COLOR} />
                      )}
                      <VStack>
                        <Text color="#f8fafc" fontWeight="800">
                          Scan #{item.id} · {item.status.toUpperCase()}
                        </Text>
                        <Text color={MUTED} fontSize="$xs">
                          {item.scanned_at || 'Recent'} · Sync: {item.sync_status}
                        </Text>
                      </VStack>
                    </HStack>

                    {/* Action buttons (Gated by permissions) */}
                    <HStack space="xs" alignItems="center">
                      {canUpdate ? (
                        <Button
                          size="xs"
                          variant="outline"
                          borderColor="#475569"
                          onPress={() => handleToggleStatus(item)}
                        >
                          <ButtonText color={YELLOW} fontSize="$xs">
                            Toggle Status
                          </ButtonText>
                        </Button>
                      ) : null}

                      {canDelete ? (
                        <Pressable onPress={() => handleDelete(item)} style={styles.trashBtn}>
                          <Trash2 size={16} color="#f87171" />
                        </Pressable>
                      ) : null}
                    </HStack>
                  </HStack>

                  {/* Token snippet */}
                  <Pressable onPress={() => setSelectedScan(item)}>
                    <Box bg={PANEL_ALT} p="$2" borderRadius="$md" mt="$2">
                      <Text color="#94a3b8" fontSize="$xs" numberOfLines={2}>
                        {item.scanned_jwt}
                      </Text>
                    </Box>
                  </Pressable>
                </Box>
              ))
            ) : (
              <Box bg={PANEL} p="$6" borderRadius="$lg" alignItems="center">
                <Text color={MUTED}>No scans recorded in queue yet.</Text>
              </Box>
            )}
          </VStack>
        </VStack>
      </Box>

      {/* Raw JWT Token View Modal */}
      <Modal
        visible={Boolean(selectedScan)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedScan(null)}
      >
        <View style={styles.modalBackdrop}>
          <Box bg={PANEL} borderWidth={2} borderColor={YELLOW} borderRadius="$xl" p="$4" width="100%" maxWidth={500}>
            <Text color={YELLOW} fontSize="$lg" fontWeight="900" mb="$2">
              Scan #{selectedScan?.id} Raw JWT
            </Text>
            <ScrollView style={{ maxHeight: 240 }} bg={PANEL_ALT} p="$3" borderRadius="$md">
              <Text color="#e2e8f0" fontSize="$xs" selectable>
                {selectedScan?.scanned_jwt}
              </Text>
            </ScrollView>
            <Button mt="$3" bg={YELLOW} onPress={() => setSelectedScan(null)}>
              <ButtonText color={BLACK} fontWeight="900">Close</ButtonText>
            </Button>
          </Box>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#111c2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
});
