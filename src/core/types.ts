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
  user_id?: number;
  shift_id?: string;
  scanned_jwt: string;
  status: 'pass' | 'fail';
  sync_status: 'pending' | 'synced' | 'failed';
  scanned_at?: string;
  notes?: string;
};

export type VerificationResult = {
  valid: boolean;
  status: 'pass' | 'fail';
  reason: string;
  payload?: Record<string, any>;
};

export type UiMode = 'PASS_FAIL_MODE' | 'DATA_MODE';

export type ShiftSession = {
  token: string;
  sub: string;
  userId: number;
  shiftId: string;
  keyId?: string;
  role?: string;
  permissions: Record<string, boolean>;
  rules?: Array<{
    rule_name?: string;
    matching_claim_key: string;
    expected_value: string;
  }>;
  exp: number;
  iat: number;
  publicKeyId?: number;
  offlineCheckoutPending?: boolean;
};
