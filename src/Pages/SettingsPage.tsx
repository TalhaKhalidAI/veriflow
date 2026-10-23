import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { addInventoryItem, addPublicKey, deleteInventoryItem, deletePublicKey, getInventoryItems, getPublicKeys, initDatabase, updateInventoryItem, updatePublicKey } from '@/core/db';
import { InventoryRecord, PublicKeyRecord } from '@/core/types';

const BLACK = '#0f172a';
const YELLOW = '#facc15';
const PANEL = '#111827';

export default function SettingsPage() {
  const [publicKeys, setPublicKeys] = useState<PublicKeyRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [keyName, setKeyName] = useState('Warehouse Key');
  const [keyValue, setKeyValue] = useState('');
  const [inventoryName, setInventoryName] = useState('Warehouse A');
  const [claimKey, setClaimKey] = useState('warehouse_id');
  const [expectedValue, setExpectedValue] = useState('WH-01');

  const refresh = async () => {
    await initDatabase();
    setPublicKeys(await getPublicKeys());
    setInventory(await getInventoryItems());
  };

  useEffect(() => {
    refresh();
  }, []);

  const saveKey = async () => {
    if (!keyName.trim() || !keyValue.trim()) return;
    await addPublicKey(keyName.trim(), keyValue.trim());
    setKeyName('');
    setKeyValue('');
    refresh();
  };

  const saveInventory = async () => {
    if (!inventoryName.trim() || !claimKey.trim() || !expectedValue.trim()) return;
    await addInventoryItem(inventoryName.trim(), claimKey.trim(), expectedValue.trim());
    setInventoryName('');
    setClaimKey('');
    setExpectedValue('');
    refresh();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Public Keys</Text>
        <TextInput value={keyName} onChangeText={setKeyName} style={styles.input} placeholder="Key name" placeholderTextColor="#9ca3af" />
        <TextInput value={keyValue} onChangeText={setKeyValue} style={[styles.input, styles.multiline]} multiline placeholder="Public key PEM" placeholderTextColor="#9ca3af" />
        <Pressable style={styles.button} onPress={saveKey}>
          <Text style={styles.buttonText}>Add Public Key</Text>
        </Pressable>

        {publicKeys.map(item => (
          <View key={item.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.name}</Text>
              <Text style={styles.itemMeta}>{item.public_key_string.slice(0, 36)}...</Text>
            </View>
            <Pressable onPress={() => deletePublicKey(item.id).then(refresh)}>
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Inventory IDs</Text>
        <TextInput value={inventoryName} onChangeText={setInventoryName} style={styles.input} placeholder="Inventory name" placeholderTextColor="#9ca3af" />
        <TextInput value={claimKey} onChangeText={setClaimKey} style={styles.input} placeholder="Claim key (e.g. warehouse_id)" placeholderTextColor="#9ca3af" />
        <TextInput value={expectedValue} onChangeText={setExpectedValue} style={styles.input} placeholder="Expected value (e.g. WH-01)" placeholderTextColor="#9ca3af" />
        <Pressable style={styles.button} onPress={saveInventory}>
          <Text style={styles.buttonText}>Add Inventory Rule</Text>
        </Pressable>

        {inventory.map(item => (
          <View key={item.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.inventory_name}</Text>
              <Text style={styles.itemMeta}>{item.matching_claim_key} = {item.expected_value}</Text>
            </View>
            <Pressable onPress={() => deleteInventoryItem(item.id).then(refresh)}>
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BLACK,
  },
  content: {
    padding: 20,
    gap: 18,
  },
  title: {
    color: YELLOW,
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 6,
  },
  section: {
    backgroundColor: PANEL,
    borderWidth: 2,
    borderColor: YELLOW,
    borderRadius: 14,
    padding: 16,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#0b1120',
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    minHeight: 44,
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  button: {
    minHeight: 56,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginBottom: 12,
  },
  buttonText: {
    color: BLACK,
    fontSize: 16,
    fontWeight: '900',
  },
  itemRow: {
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingTop: 12,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemTitle: {
    color: '#f8fafc',
    fontWeight: '700',
    marginBottom: 4,
  },
  itemMeta: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  deleteText: {
    color: '#fca5a5',
    fontWeight: '700',
  },
});
