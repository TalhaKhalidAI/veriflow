let SQLite: any = null;

try {
  SQLite = require('expo-sqlite');
} catch {
  SQLite = null;
}

import {
    InventoryRecord,
    PublicKeyRecord,
    ScanDataFieldRecord,
    ScanHistoryRecord,
    ScanRecord,
    ScanRemarkRecord,
} from './types';

const memoryStore = {
  publicKeys: [] as PublicKeyRecord[],
  inventory: [] as InventoryRecord[],
  scans: [] as ScanRecord[],
  scanHistory: [] as ScanHistoryRecord[],
  scanDataFields: [] as ScanDataFieldRecord[],
  scanRemarks: [] as ScanRemarkRecord[],
  scanFieldRemarks: [] as { fieldId: number; remarkId: number }[],
};

const db = SQLite ? SQLite.openDatabaseSync?.('veriflow.db') ?? null : null;
const dbAny = db as any;

export function initDatabase(): Promise<void> {
  if (!db) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    try {
      db.execSync('PRAGMA foreign_keys = ON;');
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

        db.execSync(`
          CREATE TABLE IF NOT EXISTS scan_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scanned_at TEXT NOT NULL,
            status TEXT NOT NULL,
            reason TEXT NOT NULL,
            selected_key_name TEXT,
            scanned_value TEXT NOT NULL,
            data_json TEXT NOT NULL
          );
        `);

        db.execSync(`
          CREATE TABLE IF NOT EXISTS scan_data_fields (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_history_id INTEGER NOT NULL,
            field_name TEXT NOT NULL,
            field_value_json TEXT NOT NULL,
            FOREIGN KEY (scan_history_id) REFERENCES scan_history(id) ON DELETE CASCADE
          );
        `);

        db.execSync(`
          CREATE TABLE IF NOT EXISTS remarks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            remark_text TEXT NOT NULL,
            created_at TEXT NOT NULL
          );
        `);

        db.execSync(`
          CREATE TABLE IF NOT EXISTS scan_data_field_remarks (
            data_field_id INTEGER NOT NULL,
            remark_id INTEGER NOT NULL,
            PRIMARY KEY (data_field_id, remark_id),
            FOREIGN KEY (data_field_id) REFERENCES scan_data_fields(id) ON DELETE CASCADE,
            FOREIGN KEY (remark_id) REFERENCES remarks(id) ON DELETE CASCADE
          );
        `);

        const historyWithoutFields = dbAny.getAllSync(`
          SELECT history.id, history.data_json
          FROM scan_history AS history
          WHERE NOT EXISTS (
            SELECT 1 FROM scan_data_fields AS fields
            WHERE fields.scan_history_id = history.id
          );
        `) as { id: number; data_json: string }[];
        historyWithoutFields.forEach(record => insertScanDataFields(record.id, record.data_json));
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

export function addScanHistory(
  scannedValue: string,
  dataJson: string,
  status: 'pass' | 'fail',
  reason: string,
  selectedKeyName: string | null,
): Promise<number> {
  const scannedAt = new Date().toISOString();
  if (!db) {
    const id = Math.max(0, ...memoryStore.scanHistory.map(item => item.id)) + 1;
    memoryStore.scanHistory.unshift({
      id,
      scanned_at: scannedAt,
      status,
      reason,
      selected_key_name: selectedKeyName,
      scanned_value: scannedValue,
      data_json: dataJson,
    });
    replaceMemoryScanDataFields(id, dataJson);
    return Promise.resolve(id);
  }

  let historyId = 0;
  db.withTransactionSync(() => {
    const result = db.runSync(
      `INSERT INTO scan_history
        (scanned_at, status, reason, selected_key_name, scanned_value, data_json)
        VALUES (?, ?, ?, ?, ?, ?)`,
      [scannedAt, status, reason, selectedKeyName, scannedValue, dataJson],
    );
    historyId = Number(result.lastInsertRowId);
    insertScanDataFields(historyId, dataJson);
  });
  return Promise.resolve(historyId);
}

export function getScanHistory(): Promise<ScanHistoryRecord[]> {
  if (!db) {
    return Promise.resolve([...memoryStore.scanHistory]);
  }
  return Promise.resolve(dbAny.getAllSync('SELECT * FROM scan_history ORDER BY scanned_at DESC, id DESC'));
}

export function updateScanHistoryData(id: number, dataJson: string): Promise<void> {
  if (!db) {
    memoryStore.scanHistory = memoryStore.scanHistory.map(item =>
      item.id === id ? { ...item, data_json: dataJson } : item,
    );
    replaceMemoryScanDataFields(id, dataJson);
    return Promise.resolve();
  }
  db.withTransactionSync(() => {
    db.runSync('UPDATE scan_history SET data_json = ? WHERE id = ?', [dataJson, id]);
    syncScanDataFields(id, dataJson);
    deleteOrphanedScanRemarks();
  });
  return Promise.resolve();
}

export function deleteScanHistory(id: number): Promise<void> {
  if (!db) {
    memoryStore.scanHistory = memoryStore.scanHistory.filter(item => item.id !== id);
    const removedFieldIds = new Set(memoryStore.scanDataFields
      .filter(field => field.scan_history_id === id)
      .map(field => field.id));
    memoryStore.scanDataFields = memoryStore.scanDataFields.filter(field => field.scan_history_id !== id);
    memoryStore.scanFieldRemarks = memoryStore.scanFieldRemarks.filter(link => !removedFieldIds.has(link.fieldId));
    pruneMemoryOrphanedRemarks();
    return Promise.resolve();
  }
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM scan_history WHERE id = ?', [id]);
    deleteOrphanedScanRemarks();
  });
  return Promise.resolve();
}

function parseDataFields(dataJson: string): [string, string][] {
  try {
    const value: unknown = JSON.parse(dataJson);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    return Object.entries(value).map(([fieldName, fieldValue]) => [fieldName, JSON.stringify(fieldValue)]);
  } catch {
    return [];
  }
}

function insertScanDataFields(scanHistoryId: number, dataJson: string): void {
  for (const [fieldName, fieldValueJson] of parseDataFields(dataJson)) {
    db.runSync(
      'INSERT INTO scan_data_fields (scan_history_id, field_name, field_value_json) VALUES (?, ?, ?)',
      [scanHistoryId, fieldName, fieldValueJson],
    );
  }
}

function syncScanDataFields(scanHistoryId: number, dataJson: string): void {
  const desiredFields = parseDataFields(dataJson);
  const desiredNames = new Set(desiredFields.map(([fieldName]) => fieldName));
  const existingFields = dbAny.getAllSync(
    'SELECT id, field_name FROM scan_data_fields WHERE scan_history_id = ?',
    [scanHistoryId],
  ) as { id: number; field_name: string }[];
  const existingByName = new Map(existingFields.map(field => [field.field_name, field.id]));

  for (const existing of existingFields) {
    if (!desiredNames.has(existing.field_name)) {
      db.runSync('DELETE FROM scan_data_fields WHERE id = ?', [existing.id]);
    }
  }

  for (const [fieldName, fieldValueJson] of desiredFields) {
    const existingId = existingByName.get(fieldName);
    if (existingId !== undefined) {
      db.runSync('UPDATE scan_data_fields SET field_value_json = ? WHERE id = ?', [fieldValueJson, existingId]);
    } else {
      db.runSync(
        'INSERT INTO scan_data_fields (scan_history_id, field_name, field_value_json) VALUES (?, ?, ?)',
        [scanHistoryId, fieldName, fieldValueJson],
      );
    }
  }
}

function deleteOrphanedScanRemarks(): void {
  db.runSync(`
    DELETE FROM remarks
    WHERE id NOT IN (
      SELECT remark_id FROM scan_data_field_remarks
    );
  `);
}

function pruneMemoryOrphanedRemarks(): void {
  const linkedRemarkIds = new Set(memoryStore.scanFieldRemarks.map(link => link.remarkId));
  memoryStore.scanRemarks = memoryStore.scanRemarks.filter(remark => linkedRemarkIds.has(remark.id));
}

function replaceMemoryScanDataFields(scanHistoryId: number, dataJson: string): void {
  const desiredFields = parseDataFields(dataJson);
  const desiredNames = new Set(desiredFields.map(([fieldName]) => fieldName));
  const existingFields = memoryStore.scanDataFields.filter(field => field.scan_history_id === scanHistoryId);
  const existingByName = new Map(existingFields.map(field => [field.field_name, field]));
  const removedIds = new Set(existingFields
    .filter(field => !desiredNames.has(field.field_name))
    .map(field => field.id));

  memoryStore.scanDataFields = memoryStore.scanDataFields.filter(field => !removedIds.has(field.id));
  memoryStore.scanFieldRemarks = memoryStore.scanFieldRemarks.filter(link => !removedIds.has(link.fieldId));

  for (const [fieldName, fieldValueJson] of desiredFields) {
    const existing = existingByName.get(fieldName);
    if (existing) {
      memoryStore.scanDataFields = memoryStore.scanDataFields.map(field =>
        field.id === existing.id ? { ...field, field_value_json: fieldValueJson } : field,
      );
    } else {
      memoryStore.scanDataFields.push({
        id: Math.max(0, ...memoryStore.scanDataFields.map(field => field.id)) + 1,
        scan_history_id: scanHistoryId,
        field_name: fieldName,
        field_value_json: fieldValueJson,
        remarks: [],
      });
    }
  }
  pruneMemoryOrphanedRemarks();
}

export function getScanDataFields(scanHistoryId: number): Promise<ScanDataFieldRecord[]> {
  if (!db) {
    return Promise.resolve(memoryStore.scanDataFields
      .filter(field => field.scan_history_id === scanHistoryId)
      .map(field => ({
        ...field,
        remarks: memoryStore.scanFieldRemarks
          .filter(link => link.fieldId === field.id)
          .map(link => memoryStore.scanRemarks.find(remark => remark.id === link.remarkId))
          .filter((remark): remark is ScanRemarkRecord => Boolean(remark)),
      })));
  }

  const rows = dbAny.getAllSync(
    `SELECT
      fields.id AS field_id,
      fields.scan_history_id,
      fields.field_name,
      fields.field_value_json,
      remarks.id AS remark_id,
      remarks.remark_text,
      remarks.created_at AS remark_created_at
    FROM scan_data_fields AS fields
    LEFT JOIN scan_data_field_remarks AS links ON links.data_field_id = fields.id
    LEFT JOIN remarks ON remarks.id = links.remark_id
    WHERE fields.scan_history_id = ?
    ORDER BY fields.id, remarks.created_at, remarks.id`,
    [scanHistoryId],
  ) as {
    field_id: number;
    scan_history_id: number;
    field_name: string;
    field_value_json: string;
    remark_id: number | null;
    remark_text: string | null;
    remark_created_at: string | null;
  }[];

  const grouped = new Map<number, ScanDataFieldRecord>();
  for (const row of rows) {
    let field = grouped.get(row.field_id);
    if (!field) {
      field = {
        id: row.field_id,
        scan_history_id: row.scan_history_id,
        field_name: row.field_name,
        field_value_json: row.field_value_json,
        remarks: [],
      };
      grouped.set(field.id, field);
    }
    if (row.remark_id !== null && row.remark_text !== null && row.remark_created_at !== null) {
      field.remarks.push({
        id: row.remark_id,
        remark_text: row.remark_text,
        created_at: row.remark_created_at,
      });
    }
  }
  return Promise.resolve([...grouped.values()]);
}

export function addRemarkToScanDataField(fieldId: number, remarkText: string): Promise<number> {
  const createdAt = new Date().toISOString();
  if (!db) {
    const remarkId = Math.max(0, ...memoryStore.scanRemarks.map(remark => remark.id)) + 1;
    memoryStore.scanRemarks.push({ id: remarkId, remark_text: remarkText, created_at: createdAt });
    memoryStore.scanFieldRemarks.push({ fieldId, remarkId });
    return Promise.resolve(remarkId);
  }

  let remarkId = 0;
  db.withTransactionSync(() => {
    const result = db.runSync(
      'INSERT INTO remarks (remark_text, created_at) VALUES (?, ?)',
      [remarkText, createdAt],
    );
    remarkId = Number(result.lastInsertRowId);
    db.runSync(
      'INSERT INTO scan_data_field_remarks (data_field_id, remark_id) VALUES (?, ?)',
      [fieldId, remarkId],
    );
  });
  return Promise.resolve(remarkId);
}

export function updateScanRemark(remarkId: number, remarkText: string): Promise<void> {
  if (!db) {
    memoryStore.scanRemarks = memoryStore.scanRemarks.map(remark =>
      remark.id === remarkId ? { ...remark, remark_text: remarkText } : remark,
    );
    return Promise.resolve();
  }
  db.runSync('UPDATE remarks SET remark_text = ? WHERE id = ?', [remarkText, remarkId]);
  return Promise.resolve();
}

export function deleteScanRemark(remarkId: number): Promise<void> {
  if (!db) {
    memoryStore.scanRemarks = memoryStore.scanRemarks.filter(remark => remark.id !== remarkId);
    memoryStore.scanFieldRemarks = memoryStore.scanFieldRemarks.filter(link => link.remarkId !== remarkId);
    return Promise.resolve();
  }
  db.runSync('DELETE FROM remarks WHERE id = ?', [remarkId]);
  return Promise.resolve();
}

export function deleteScanRemarkFromField(fieldId: number, remarkId: number): Promise<void> {
  if (!db) {
    memoryStore.scanFieldRemarks = memoryStore.scanFieldRemarks.filter(
      link => link.fieldId !== fieldId || link.remarkId !== remarkId,
    );
    if (!memoryStore.scanFieldRemarks.some(link => link.remarkId === remarkId)) {
      memoryStore.scanRemarks = memoryStore.scanRemarks.filter(remark => remark.id !== remarkId);
    }
    return Promise.resolve();
  }
  db.withTransactionSync(() => {
    db.runSync(
      'DELETE FROM scan_data_field_remarks WHERE data_field_id = ? AND remark_id = ?',
      [fieldId, remarkId],
    );
    const links = dbAny.getAllSync(
      'SELECT data_field_id FROM scan_data_field_remarks WHERE remark_id = ?',
      [remarkId],
    ) as unknown[];
    if (links.length === 0) db.runSync('DELETE FROM remarks WHERE id = ?', [remarkId]);
  });
  return Promise.resolve();
}
// src/core/db.ts

export async function checkScanExists(scannedValue: string): Promise<boolean> {
  if (!db) {
    // Memory fallback
    return memoryStore.scanHistory.some(item => item.scanned_value === scannedValue);
  }

  try {
    // Using the sync API since your entire file relies on it
    const result = dbAny.getFirstSync(
      'SELECT COUNT(*) as count FROM scan_history WHERE scanned_value = ?', 
      [scannedValue]
    ) as { count: number } | null;
    
    return (result?.count ?? 0) > 0;
  } catch (error) {
    console.error("❌ checkScanExists query failed:", error);
    return false; 
  }
}