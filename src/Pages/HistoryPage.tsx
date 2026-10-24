import {
    Box,
    Button,
    ButtonText,
    HStack,
    Input,
    InputField,
    Pressable,
    ScrollView,
    Text,
    VStack,
} from '@gluestack-ui/themed';
import { Pencil, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Image, Modal, StyleSheet, View } from 'react-native';

import {
    addRemarkToScanDataField,
    deleteScanHistory,
    deleteScanRemarkFromField,
    getScanDataFields,
    getScanHistory,
    initDatabase,
    updateScanHistoryData,
    updateScanRemark,
} from '@/core/db';
import { ScanDataFieldRecord, ScanHistoryRecord, ScanRemarkRecord } from '@/core/types';

const BLACK = '#07111d';
const PANEL = '#0f172a';
const YELLOW = '#facc15';
const MUTED = '#cbd5e1';

function formatScannedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function getDataPreview(dataJson: string): string {
  try {
    return JSON.stringify(JSON.parse(dataJson));
  } catch {
    return dataJson;
  }
}

function formatFieldValue(valueJson: string): string {
  try {
    const value: unknown = JSON.parse(valueJson);
    return typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return valueJson;
  }
}

export default function HistoryPage() {
  const [records, setRecords] = useState<ScanHistoryRecord[]>([]);
  const [fieldsByRecord, setFieldsByRecord] = useState<Record<number, ScanDataFieldRecord[]>>({});
  const [editingRecord, setEditingRecord] = useState<ScanHistoryRecord | null>(null);
  const [editedJson, setEditedJson] = useState('');
  const [editError, setEditError] = useState('');
  const [editingRemark, setEditingRemark] = useState<{ fieldId: number; remark: ScanRemarkRecord | null } | null>(null);
  const [remarkDraft, setRemarkDraft] = useState('');
  const [remarkError, setRemarkError] = useState('');

  const refresh = async () => {
    await initDatabase();
    const history = await getScanHistory();
    const fieldEntries = await Promise.all(history.map(async record => [
      record.id,
      await getScanDataFields(record.id),
    ] as const));
    setRecords(history);
    setFieldsByRecord(Object.fromEntries(fieldEntries));
  };

  useEffect(() => {
    void refresh();
  }, []);

  const startEdit = (record: ScanHistoryRecord) => {
    setEditingRecord(record);
    setEditError('');
    try {
      setEditedJson(JSON.stringify(JSON.parse(record.data_json), null, 2));
    } catch {
      setEditedJson(record.data_json);
    }
  };

  const saveEdit = async () => {
    if (!editingRecord) return;

    try {
      const normalizedJson = JSON.stringify(JSON.parse(editedJson));
      await updateScanHistoryData(editingRecord.id, normalizedJson);
      setEditingRecord(null);
      await refresh();
    } catch {
      setEditError('Enter valid JSON before saving.');
    }
  };

  const confirmDelete = (record: ScanHistoryRecord) => {
    Alert.alert('Delete scan record?', 'This history item will be removed from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteScanHistory(record.id).then(refresh);
        },
      },
    ]);
  };

  const openRemarkEditor = (fieldId: number, remark: ScanRemarkRecord | null = null) => {
    setEditingRemark({ fieldId, remark });
    setRemarkDraft(remark?.remark_text ?? '');
    setRemarkError('');
  };

  const saveRemark = async () => {
    if (!editingRemark || !remarkDraft.trim()) {
      setRemarkError('Enter a remark before saving.');
      return;
    }

    if (editingRemark.remark) {
      await updateScanRemark(editingRemark.remark.id, remarkDraft.trim());
    } else {
      await addRemarkToScanDataField(editingRemark.fieldId, remarkDraft.trim());
    }
    setEditingRemark(null);
    await refresh();
  };

  const confirmDeleteRemark = (fieldId: number, remark: ScanRemarkRecord) => {
    Alert.alert('Delete remark?', 'This remark will be removed from this claim.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteScanRemarkFromField(fieldId, remark.id).then(refresh);
        },
      },
    ]);
  };

  return (
    <ScrollView bg={BLACK} flex={1}>
      <Box px="$4" py="$5">
        <VStack space="md">
          <HStack alignItems="center" space="sm">
            <Image
              source={require('../assets/msi_white.png')}
              style={styles.brandMark}
              resizeMode="contain"
              accessibilityLabel="VeriFlow logo"
            />
            <VStack space="xs" flex={1}>
              <Text color={YELLOW} fontSize="$2xl" fontWeight="900">
                Scan History
              </Text>
              <Text color={MUTED} fontSize="$sm">
                {records.length} {records.length === 1 ? 'record' : 'records'} stored on this device
              </Text>
            </VStack>
          </HStack>

          <Box borderWidth={2} borderColor={YELLOW} borderRadius="$xl" bg={PANEL} p="$3">
            <HStack
              alignItems="center"
              borderBottomWidth={1}
              borderBottomColor="#334155"
              pb="$2"
              px="$2"
            >
              <Text color={MUTED} fontSize="$xs" fontWeight="800" flex={1}>
                SCAN / DATA
              </Text>
              <Text color={MUTED} fontSize="$xs" fontWeight="800" mr="$3">
                ACTIONS
              </Text>
            </HStack>

            {records.map(record => (
              <HStack
                key={record.id}
                alignItems="center"
                space="sm"
                borderBottomWidth={1}
                borderBottomColor="#26354a"
                py="$3"
                px="$2"
              >
                <VStack flex={1} minWidth={0} space="xs">
                  <HStack alignItems="center" justifyContent="space-between" space="sm">
                    <Text color={record.status === 'pass' ? '#22c55e' : '#f87171'} fontWeight="900">
                      {record.status.toUpperCase()}
                    </Text>
                    <Text color={MUTED} fontSize="$xs" flex={1} textAlign="right" numberOfLines={1}>
                      {formatScannedAt(record.scanned_at)}
                    </Text>
                  </HStack>
                  {record.selected_key_name ? (
                    <Text color="#e2e8f0" fontSize="$xs" numberOfLines={1}>
                      Key: {record.selected_key_name}
                    </Text>
                  ) : null}
                  <Text color="#f8fafc" fontSize="$xs" numberOfLines={2}>
                    {getDataPreview(record.data_json)}
                  </Text>
                  {(fieldsByRecord[record.id] ?? []).map(field => (
                    <Box
                      key={field.id}
                      mt="$2"
                      px="$3"
                      py="$2"
                      bg="#0b1220"
                      borderLeftWidth={2}
                      borderLeftColor={YELLOW}
                    >
                      <Text color={YELLOW} fontSize="$xs" fontWeight="800" numberOfLines={1}>
                        {field.field_name}
                      </Text>
                      <Text color="#f8fafc" fontSize="$xs" selectable>
                        {formatFieldValue(field.field_value_json)}
                      </Text>
                      {field.remarks.map(remark => (
                        <HStack key={remark.id} alignItems="center" space="xs" mt="$2">
                          <Text color={MUTED} fontSize="$xs" flex={1} selectable>
                            {remark.remark_text}
                          </Text>
                          <Pressable
                            style={styles.smallIconButton}
                            onPress={() => openRemarkEditor(field.id, remark)}
                            accessibilityRole="button"
                            accessibilityLabel="Edit remark"
                            hitSlop={6}
                          >
                            <Pencil size={14} color={YELLOW} />
                          </Pressable>
                          <Pressable
                            style={styles.smallIconButton}
                            onPress={() => confirmDeleteRemark(field.id, remark)}
                            accessibilityRole="button"
                            accessibilityLabel="Delete remark"
                            hitSlop={6}
                          >
                            <Trash2 size={14} color="#fca5a5" />
                          </Pressable>
                        </HStack>
                      ))}
                      <Pressable onPress={() => openRemarkEditor(field.id)} accessibilityRole="button">
                        <Text color={YELLOW} fontSize="$xs" fontWeight="700" mt="$2">
                          + Add remark
                        </Text>
                      </Pressable>
                    </Box>
                  ))}
                  <Text color={MUTED} fontSize="$xs" numberOfLines={2}>
                    {record.reason}
                  </Text>
                </VStack>

                <VStack space="xs">
                  <Pressable
                    style={styles.iconButton}
                    onPress={() => startEdit(record)}
                    accessibilityRole="button"
                    accessibilityLabel="Edit scan data"
                    hitSlop={8}
                  >
                    <Pencil size={18} color={YELLOW} />
                  </Pressable>
                  <Pressable
                    style={styles.iconButton}
                    onPress={() => confirmDelete(record)}
                    accessibilityRole="button"
                    accessibilityLabel="Delete scan record"
                    hitSlop={8}
                  >
                    <Trash2 size={18} color="#fca5a5" />
                  </Pressable>
                </VStack>
              </HStack>
            ))}

            {!records.length ? (
              <Text color={MUTED} fontSize="$sm" py="$6" textAlign="center">
                Scans will appear here after they are recorded.
              </Text>
            ) : null}
          </Box>
        </VStack>
      </Box>

      <Modal
        visible={Boolean(editingRecord)}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingRecord(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setEditingRecord(null)}
            accessibilityLabel="Close edit dialog"
          />
          <Box width="100%" maxWidth={520} bg={PANEL} borderWidth={2} borderColor={YELLOW} borderRadius="$xl" p="$4">
            <Text color="#f8fafc" fontSize="$xl" fontWeight="800" mb="$3">
              Edit Scan Data
            </Text>
            <Input variant="outline" size="lg" borderColor="#334155">
              <InputField
                value={editedJson}
                onChangeText={setEditedJson}
                placeholder="JSON data"
                placeholderTextColor="#94a3b8"
                color="#f8fafc"
                multiline
                numberOfLines={10}
                textAlignVertical="top"
                minHeight={220}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Input>
            {editError ? (
              <Text color="#fca5a5" fontSize="$sm" mt="$2">
                {editError}
              </Text>
            ) : null}
            <HStack space="sm" justifyContent="flex-end" mt="$4">
              <Button variant="outline" borderColor="#64748b" onPress={() => setEditingRecord(null)}>
                <ButtonText color="#e2e8f0">Cancel</ButtonText>
              </Button>
              <Button bg={YELLOW} onPress={saveEdit}>
                <ButtonText color={BLACK} fontWeight="900">Save Data</ButtonText>
              </Button>
            </HStack>
          </Box>
        </View>
      </Modal>

      <Modal
        visible={Boolean(editingRemark)}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingRemark(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setEditingRemark(null)}
            accessibilityLabel="Close remark dialog"
          />
          <Box width="100%" maxWidth={520} bg={PANEL} borderWidth={2} borderColor={YELLOW} borderRadius="$xl" p="$4">
            <Text color="#f8fafc" fontSize="$xl" fontWeight="800" mb="$3">
              {editingRemark?.remark ? 'Edit Remark' : 'Add Remark'}
            </Text>
            <Input variant="outline" size="lg" borderColor="#334155">
              <InputField
                value={remarkDraft}
                onChangeText={setRemarkDraft}
                placeholder="Remark for this claim"
                placeholderTextColor="#94a3b8"
                color="#f8fafc"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                minHeight={100}
              />
            </Input>
            {remarkError ? (
              <Text color="#fca5a5" fontSize="$sm" mt="$2">
                {remarkError}
              </Text>
            ) : null}
            <HStack space="sm" justifyContent="flex-end" mt="$4">
              <Button variant="outline" borderColor="#64748b" onPress={() => setEditingRemark(null)}>
                <ButtonText color="#e2e8f0">Cancel</ButtonText>
              </Button>
              <Button bg={YELLOW} onPress={saveRemark}>
                <ButtonText color={BLACK} fontWeight="900">Save Remark</ButtonText>
              </Button>
            </HStack>
          </Box>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  brandMark: {
    width: 48,
    height: 42,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111c2e',
  },
  smallIconButton: {
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111c2e',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.76)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
});