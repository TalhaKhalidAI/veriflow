let SQLite: any = null;

try {
  SQLite = require('expo-sqlite');
} catch {
  SQLite = null;
}

import { InventoryRecord, PublicKeyRecord, ScanRecord } from './types';

const memoryStore = {
  publicKeys: [] as PublicKeyRecord[],
  inventory: [] as InventoryRecord[],
  scans: [] as ScanRecord[],
};

const db = SQLite ? SQLite.openDatabaseSync?.('veriflow.db') ?? null : null;
const dbAny = db as any;

export function initDatabase(): Promise<void> {
  if (!db) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    try {
      db.withTransactionSync(() => {
        db.execSync(`
          CREATE TABLE IF NOT EXISTS public_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            public_key_string TEXT NOT NULL,
            created_at TEXT NOT NULL
          );
        `);

        db.execSync(`
          CREATE TABLE IF NOT EXISTS inventory_ids (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inventory_name TEXT NOT NULL,
            matching_claim_key TEXT NOT NULL,
            expected_value TEXT NOT NULL
          );
        `);

        db.execSync(`
          CREATE TABLE IF NOT EXISTS scans_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scanned_jwt TEXT NOT NULL,
            status TEXT NOT NULL,
            sync_status TEXT NOT NULL DEFAULT 'pending'
          );
        `);
      });
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

export function getPublicKeys(): Promise<PublicKeyRecord[]> {
  if (!db) {
    return Promise.resolve(memoryStore.publicKeys);
  }
  return Promise.resolve(dbAny.getAllSync('SELECT * FROM public_keys ORDER BY created_at DESC'));
}

export function addPublicKey(name: string, publicKeyString: string): Promise<number> {
  if (!db) {
    const item: PublicKeyRecord = {
      id: memoryStore.publicKeys.length + 1,
      name,
      public_key_string: publicKeyString,
      created_at: new Date().toISOString(),
    };
    memoryStore.publicKeys.unshift(item);
    return Promise.resolve(item.id);
  }

  const result = db.runSync(
    'INSERT INTO public_keys (name, public_key_string, created_at) VALUES (?, ?, ?)',
    [name, publicKeyString, new Date().toISOString()],
  );
  return Promise.resolve(Number(result.lastInsertRowId));
}

export function updatePublicKey(id: number, name: string, publicKeyString: string): Promise<void> {
  if (!db) {
    memoryStore.publicKeys = memoryStore.publicKeys.map(item => item.id === id ? { ...item, name, public_key_string: publicKeyString } : item);
    return Promise.resolve();
  }
  db.runSync('UPDATE public_keys SET name = ?, public_key_string = ? WHERE id = ?', [name, publicKeyString, id]);
  return Promise.resolve();
}

export function deletePublicKey(id: number): Promise<void> {
  if (!db) {
    memoryStore.publicKeys = memoryStore.publicKeys.filter(item => item.id !== id);
    return Promise.resolve();
  }
  db.runSync('DELETE FROM public_keys WHERE id = ?', [id]);
  return Promise.resolve();
}

export function getInventoryItems(): Promise<InventoryRecord[]> {
  if (!db) {
    return Promise.resolve(memoryStore.inventory);
  }
  return Promise.resolve(dbAny.getAllSync('SELECT * FROM inventory_ids ORDER BY id DESC'));
}

export function addInventoryItem(
  inventoryName: string,
  matchingClaimKey: string,
  expectedValue: string,
): Promise<number> {
  if (!db) {
    const item: InventoryRecord = {
      id: memoryStore.inventory.length + 1,
      inventory_name: inventoryName,
      matching_claim_key: matchingClaimKey,
      expected_value: expectedValue,
    };
    memoryStore.inventory.unshift(item);
    return Promise.resolve(item.id);
  }

  const result = db.runSync(
    'INSERT INTO inventory_ids (inventory_name, matching_claim_key, expected_value) VALUES (?, ?, ?)',
    [inventoryName, matchingClaimKey, expectedValue],
  );
  return Promise.resolve(Number(result.lastInsertRowId));
}

export function updateInventoryItem(
  id: number,
  inventoryName: string,
  matchingClaimKey: string,
  expectedValue: string,
): Promise<void> {
  if (!db) {
    memoryStore.inventory = memoryStore.inventory.map(item => item.id === id ? { ...item, inventory_name: inventoryName, matching_claim_key: matchingClaimKey, expected_value: expectedValue } : item);
    return Promise.resolve();
  }
  db.runSync(
    'UPDATE inventory_ids SET inventory_name = ?, matching_claim_key = ?, expected_value = ? WHERE id = ?',
    [inventoryName, matchingClaimKey, expectedValue, id],
  );
  return Promise.resolve();
}

export function deleteInventoryItem(id: number): Promise<void> {
  if (!db) {
    memoryStore.inventory = memoryStore.inventory.filter(item => item.id !== id);
    return Promise.resolve();
  }
  db.runSync('DELETE FROM inventory_ids WHERE id = ?', [id]);
  return Promise.resolve();
}

export function addScanToQueue(scannedJwt: string, status: 'pass' | 'fail'): Promise<number> {
  if (!db) {
    const item: ScanRecord = {
      id: memoryStore.scans.length + 1,
      scanned_jwt: scannedJwt,
      status,
      sync_status: 'pending',
    };
    memoryStore.scans.unshift(item);
    return Promise.resolve(item.id);
  }

  const result = db.runSync(
    'INSERT INTO scans_queue (scanned_jwt, status, sync_status) VALUES (?, ?, ?)',
    [scannedJwt, status, 'pending'],
  );
  return Promise.resolve(Number(result.lastInsertRowId));
}

export function getPendingScans(): Promise<ScanRecord[]> {
  if (!db) {
    return Promise.resolve(memoryStore.scans.filter(item => item.sync_status === 'pending'));
  }
  return Promise.resolve(dbAny.getAllSync('SELECT * FROM scans_queue WHERE sync_status = ? ORDER BY id DESC', ['pending']));
}
