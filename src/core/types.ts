export type PublicKeyRecord = {
  id: number;
  name: string;
  public_key_string: string;
  created_at: string;
};

export type InventoryRecord = {
  id: number;
  inventory_name: string;
  matching_claim_key: string;
  expected_value: string;
};

export type ScanRecord = {
  id: number;
  scanned_jwt: string;
  status: 'pass' | 'fail';
  sync_status: 'pending';
};

export type ScanHistoryRecord = {
  id: number;
  scanned_at: string;
  status: 'pass' | 'fail';
  reason: string;
  selected_key_name: string | null;
  scanned_value: string;
  data_json: string;
};

export type ScanRemarkRecord = {
  id: number;
  remark_text: string;
  created_at: string;
};

export type ScanDataFieldRecord = {
  id: number;
  scan_history_id: number;
  field_name: string;
  field_value_json: string;
  remarks: ScanRemarkRecord[];
};

export type VerificationResult = {
  valid: boolean;
  status: 'pass' | 'fail';
  reason: string;
  payload?: Record<string, any>;
};

export type UiMode = 'PASS_FAIL_MODE' | 'DATA_MODE';
