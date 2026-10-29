import { Platform } from 'react-native';
import { VerificationResult } from './types';

type JoseModule = typeof import('jose');

function ensureCryptoAvailable(): boolean {
  try {
    if (Platform.OS === 'web') {
      return typeof globalThis.crypto?.subtle !== 'undefined';
    }

    const quickCrypto = require('react-native-quick-crypto') as {
      install?: () => void;
      subtle?: SubtleCrypto;
      getRandomValues?: typeof crypto.getRandomValues;
    };

    if (typeof quickCrypto.install === 'function') {
      quickCrypto.install();
    }

    if (typeof globalThis.crypto === 'undefined' && quickCrypto.subtle) {
      Object.defineProperty(globalThis, 'crypto', {
        value: quickCrypto,
        configurable: true,
        writable: true,
      });
    }

    if (globalThis.crypto && !globalThis.crypto.subtle && quickCrypto.subtle) {
      Object.defineProperty(globalThis.crypto, 'subtle', {
        value: quickCrypto.subtle,
        configurable: true,
        writable: true,
      });
    }

    return typeof globalThis.crypto?.subtle !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Robustly sanitizes and normalizes PEM blocks:
 * 1. Unescapes literal \n and \r sequences from JSON/Swagger copy-paste.
 * 2. Rejects PRIVATE keys with a clear, helpful diagnostic.
 * 3. Strips all invalid/whitespace characters from the base64 body.
 * 4. Reconstructs a standard SPKI PEM block.
 */
export function normalizePublicKey(publicKeyPem: string): string {
  if (!publicKeyPem || !publicKeyPem.trim()) {
    throw new Error('Public key is empty. Paste or select a valid PEM block.');
  }

  // 1. Unescape literal newlines/returns and trim
  let clean = publicKeyPem
    .replace(/\\r/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\r/g, '')
    .trim();

  // 2. Strip surrounding quotes if copied from JSON string ("...")
  if (
    (clean.startsWith('"') && clean.endsWith('"')) ||
    (clean.startsWith("'") && clean.endsWith("'"))
  ) {
    clean = clean.slice(1, -1).trim();
    clean = clean.replace(/\\r/g, '').replace(/\\n/g, '\n');
  }

  // 3. Reject Private Keys explicitly to avoid confusing base64 errors
  if (clean.includes('PRIVATE KEY')) {
    throw new Error(
      'You entered a PRIVATE KEY. The scanner verifies RS256 signatures and requires the matching PUBLIC KEY (-----BEGIN PUBLIC KEY-----).',
    );
  }

  // 4. Extract base64 content between headers or raw
  const blockMatch = clean.match(
    /-----BEGIN (?:RSA )?PUBLIC KEY-----([\s\S]*?)-----END (?:RSA )?PUBLIC KEY-----/,
  );

  let base64Body = '';
  if (blockMatch) {
    // Keep ONLY valid base64 characters
    base64Body = blockMatch[1].replace(/[^A-Za-z0-9+/=]/g, '');
  } else {
    // If user pasted pure base64 without headers
    base64Body = clean.replace(/[^A-Za-z0-9+/=]/g, '');
  }

  if (!base64Body || base64Body.length < 32) {
    throw new Error(
      'Invalid public key: Could not find valid Base64 SPKI content. Ensure you copy the complete PUBLIC KEY block.',
    );
  }

  // 5. Reconstruct canonical PEM with 64-character lines
  const lines = base64Body.match(/.{1,64}/g) || [base64Body];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
}

/**
 * Sanitizes and normalizes the scanned QR JWT string
 */
export function normalizeJwtToken(rawToken: string): string {
  let token = rawToken.trim();

  // Strip surrounding quotes if scanned from string or json
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }

  // Strip "Bearer " prefix if user scanned Authorization header
  if (token.toLowerCase().startsWith('bearer ')) {
    token = token.slice(7).trim();
  }

  // Remove any stray whitespace or invisible linebreaks inside QR
  token = token.replace(/\s+/g, '');

  return token;
}

export interface RuleCheck {
  ruleName?: string;
  matchingClaimKey: string;
  expectedValue: string;
}

export async function verifyJwtAgainstPublicKey(
  token: string,
  publicKeyPem: string,
  expectedClaimKeyOrRules?: string | RuleCheck[],
  expectedValue?: string,
): Promise<VerificationResult> {
  try {
    const cryptoReady = ensureCryptoAvailable();
    if (!cryptoReady) {
      return {
        valid: false,
        status: 'fail',
        reason:
          Platform.OS === 'web'
            ? 'Web Crypto is unavailable in this browser'
            : 'Native crypto module is missing. Rebuild the app to verify signed data.',
      };
    }

    const normalizedToken = normalizeJwtToken(token);
    if (!normalizedToken) {
      return {
        valid: false,
        status: 'fail',
        reason: 'Scanned QR code is empty',
      };
    }

    // Verify JWT structure (header.payload.signature)
    const tokenParts = normalizedToken.split('.');
    if (tokenParts.length !== 3) {
      return {
        valid: false,
        status: 'fail',
        reason: `Scanned QR is not a valid 3-part JWT token (found ${tokenParts.length} parts, expected 3).`,
        errorCode: 'INVALID_TOKEN',
      };
    }

    // Decode unverified payload to extract claims for diagnostic context
    let unverifiedPayload: Record<string, any> | undefined;
    try {
      const base64 = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonStr = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
      unverifiedPayload = JSON.parse(jsonStr);
    } catch {
      // ignore
    }

    let pem: string;
    try {
      pem = normalizePublicKey(publicKeyPem);
    } catch (pemErr: any) {
      return {
        valid: false,
        status: 'fail',
        reason: pemErr.message || 'Invalid public key format or certificate error',
        errorCode: 'INVALID_CERT',
        payload: unverifiedPayload,
      };
    }

    const jose = require('jose') as JoseModule;
    const { importSPKI, jwtVerify } = jose;

    let key: any;
    try {
      key = await importSPKI(pem, 'RS256');
    } catch (spkiErr: any) {
      return {
        valid: false,
        status: 'fail',
        reason: `Public key SPKI import failed: ${spkiErr.message}. Ensure you are using the matching RS256 PUBLIC KEY certificate.`,
        errorCode: 'INVALID_CERT',
        payload: unverifiedPayload,
      };
    }

    let verifyResult: any;
    try {
      verifyResult = await jwtVerify(normalizedToken, key, { algorithms: ['RS256'] });
    } catch (jwtErr: any) {
      const msg = String(jwtErr?.message || '');
      const code = String(jwtErr?.code || '');
      const name = String(jwtErr?.name || '');

      // Check if signature check failed due to expiration
      if (
        code === 'ERR_JWT_EXPIRED' ||
        name === 'JWTExpired' ||
        msg.toLowerCase().includes('exp') ||
        msg.toLowerCase().includes('expired') ||
        (unverifiedPayload?.exp && Number(unverifiedPayload.exp) < Math.floor(Date.now() / 1000))
      ) {
        const expDate = unverifiedPayload?.exp ? new Date(Number(unverifiedPayload.exp) * 1000).toLocaleString() : 'past time';
        return {
          valid: false,
          status: 'fail',
          reason: `Token Expired: Shift badge expired at ${expDate}.`,
          errorCode: 'EXPIRED',
          payload: unverifiedPayload,
        };
      }

      // Key mismatch or decrypt/signature failure
      return {
        valid: false,
        status: 'fail',
        reason: `Key Mismatch / Invalid Signature: Scanned QR signature does not match public key (${msg}).`,
        errorCode: 'KEY_MISMATCH',
        payload: unverifiedPayload,
      };
    }

    const payload = verifyResult.payload;

    if (!payload.exp || Number(payload.exp) < Math.floor(Date.now() / 1000)) {
      const expDate = payload.exp ? new Date(Number(payload.exp) * 1000).toLocaleString() : 'unknown';
      return {
        valid: false,
        status: 'fail',
        reason: `Token Expired: Shift badge expired on ${expDate}.`,
        errorCode: 'EXPIRED',
        payload: payload as Record<string, any>,
      };
    }

    // Single rule check
    if (typeof expectedClaimKeyOrRules === 'string' && expectedValue !== undefined) {
      const actualValue = payload[expectedClaimKeyOrRules];
      if (String(actualValue) !== String(expectedValue)) {
        return {
          valid: false,
          status: 'fail',
          reason: `Claim '${expectedClaimKeyOrRules}' mismatch (expected: "${expectedValue}", got: "${actualValue ?? 'undefined'}")`,
          payload: payload as Record<string, any>,
        };
      }
    }

    // Multiple inventory rules check
    if (Array.isArray(expectedClaimKeyOrRules) && expectedClaimKeyOrRules.length > 0) {
      for (const rule of expectedClaimKeyOrRules) {
        const actualValue = payload[rule.matchingClaimKey];
        if (actualValue === undefined || String(actualValue) !== String(rule.expectedValue)) {
          return {
            valid: false,
            status: 'fail',
            reason: `Rule failed [${rule.ruleName || rule.matchingClaimKey}]: claim '${rule.matchingClaimKey}' expected '${rule.expectedValue}' but got '${actualValue ?? 'missing'}'`,
            payload: payload as Record<string, any>,
          };
        }
      }
    }

    return {
      valid: true,
      status: 'pass',
      reason: 'RS256 Signature and Claim Rules Verified',
      payload: payload as Record<string, any>,
    };
  } catch (error: any) {
    return {
      valid: false,
      status: 'fail',
      reason: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Decodes the unverified payload claims from a JWT token without verifying signature.
 * Returns null if the token cannot be parsed as a JWT.
 */
export function extractJwtPayload(rawToken: string): Record<string, any> | null {
  try {
    const token = normalizeJwtToken(rawToken);
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Decodes the unverified header from a JWT token.
 * Returns null if the token header cannot be parsed.
 */
export function extractJwtHeader(rawToken: string): Record<string, any> | null {
  try {
    const token = normalizeJwtToken(rawToken);
    const parts = token.split('.');
    if (parts.length < 1) return null;
    const base64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}
