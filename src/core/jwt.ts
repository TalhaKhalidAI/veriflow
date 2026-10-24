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

function normalizePublicKey(publicKeyPem: string): string {
  const trimmedKey = publicKeyPem.trim();
  if (!trimmedKey) {
    throw new Error('Public key is empty. Paste the full PEM block.');
  }

  const blockMatch = trimmedKey.match(/-----BEGIN [A-Z0-9 ]*PUBLIC KEY-----[\s\S]*?-----END [A-Z0-9 ]*PUBLIC KEY-----/);
  if (blockMatch) {
    const block = blockMatch[0].trim();
    return block
      .replace(/-----BEGIN RSA PUBLIC KEY-----/g, '-----BEGIN PUBLIC KEY-----')
      .replace(/-----END RSA PUBLIC KEY-----/g, '-----END PUBLIC KEY-----');
  }

  const compact = trimmedKey.replace(/\s+/g, '');
  if (!compact) {
    throw new Error('Public key could not be parsed. Paste one PEM block with BEGIN/END markers.');
  }

  return `-----BEGIN PUBLIC KEY-----\n${compact}\n-----END PUBLIC KEY-----`;
}

export async function verifyJwtAgainstPublicKey(
  token: string,
  publicKeyPem: string,
  expectedClaimKey?: string,
  expectedValue?: string,
): Promise<VerificationResult> {
  try {
    const cryptoReady = ensureCryptoAvailable();
    if (!cryptoReady) {
      return {
        valid: false,
        status: 'fail',
        reason: Platform.OS === 'web'
          ? 'Web Crypto is unavailable in this browser'
          : 'Native crypto module is missing. Rebuild the app to verify signed data.',
      };
    }

    const jose = require('jose') as JoseModule;
    const { importSPKI, jwtVerify } = jose;
    const normalizedToken = token.trim();
    const pem = normalizePublicKey(publicKeyPem);

    console.log('JWT_VERIFY_DEBUG', {
      tokenLength: normalizedToken.length,
      tokenPreview: normalizedToken.slice(0, 120),
      pemLength: pem.length,
      pemPreview: pem.slice(0, 120),
      hasBegin: pem.includes('-----BEGIN'),
      hasEnd: pem.includes('-----END'),
    });

    const key = await importSPKI(pem, 'RS256');
    const { payload } = await jwtVerify(normalizedToken, key, { algorithms: ['RS256'] });

    if (!payload.exp || Number(payload.exp) < Math.floor(Date.now() / 1000)) {
      return {
        valid: false,
        status: 'fail',
        reason: 'Signed data expired or is missing its expiration claim',
        payload: payload as Record<string, any>,
      };
    }

    if (expectedClaimKey && expectedValue) {
      const actualValue = payload[expectedClaimKey];
      if (String(actualValue) !== String(expectedValue)) {
        return {
          valid: false,
          status: 'fail',
          reason: `Claim ${expectedClaimKey} mismatch`,
          payload: payload as Record<string, any>,
        };
      }
    }

    return {
      valid: true,
      status: 'pass',
      reason: 'Verification passed',
      payload: payload as Record<string, any>,
    };
  } catch (error) {
    console.log('JWT_VERIFY_ERROR', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      token: token?.trim?.().slice?.(0, 200),
      pemPreview: publicKeyPem?.trim?.().slice?.(0, 200),
    });

    return {
      valid: false,
      status: 'fail',
      reason: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}
