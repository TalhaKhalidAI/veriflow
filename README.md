# VeriFlow: Enterprise Offline-First Cryptographic Verification System

## 1. The Problems Businesses Have (The Pain)

*   **The "Dead Zone" Dilemma:** Warehouses, airports, and crowded stadiums have terrible internet. When Wi-Fi drops, standard cloud-based scanners completely fail. Operations grind to a halt.
*   **The Forgery Threat:** Standard QR codes or barcodes are incredibly easy to copy. A customer can screenshot a ticket, or a thief can print a fake inventory tag. If the server is offline, the scanner has no way to know it's fake.
*   **The "Network Tax":** Every scan requires a round-trip to a server. If the network is slow, the scanner is slow. This creates massive lines at event gates and bottlenecks in warehouses.
*   **Poor Ergonomics:** Most scanning apps have tiny buttons and complex menus. In a loud, fast-paced environment, workers wearing gloves can't use them efficiently.

## 2. How the Problem Can Be Solved (The Industry Standard)

*   **Asymmetric Cryptography:** Instead of asking a server "Is this real?", the scanner can use a Public Key to mathematically verify a Private Key signature entirely on the device. If the math matches, the ticket is real. It's virtually impossible to forge.
*   **Offline-First Architecture:** The app should store its verification rules locally on the phone (using SQLite). It processes the scan instantly, saves it locally, and syncs to the cloud later when the internet returns.
*   **Zero-Latency UX:** The app must give immediate, unmistakable physical feedback (like a massive green screen and a vibration) so the worker knows the result in milliseconds.

## 3. How VeriFlow Solves It (The Solution)

*   **100% Offline Verification:** VeriFlow uses public-key cryptography to verify the authenticity of a QR code entirely on the device. No internet required. Turn on Airplane mode, and it still works perfectly.
*   **Bouncer Mode vs. Inspector Mode:**
    *   *Bouncer Mode* shows a massive Green "PASS" or Red "FAIL" screen for fast-moving event staff and security.
    *   *Inspector Mode* decodes the secure payload beautifully for warehouse managers who need to read the item ID, destination, or tracking data.
*   **Dynamic Key Management:** Businesses can store multiple Public Keys in the app's local SQLite database. A security guard can instantly switch from checking "Stadium A" tickets to "Warehouse B" inventory without downloading a new app.
*   **Industrial UI:** Designed with a high-contrast Black and Yellow theme, 56px touch targets for gloved hands, and instant Haptic feedback.

## 4. Key Generation (The Foundation)

Before signing or verifying any data, you must generate a key pair. The Private Key is kept securely on the server, and the Public Key is distributed to the mobile apps.

### Generate the Private Key
```bash
openssl genrsa -out veriflow-private.pem 2048
```
### Generate the Public Key (Derived from Private Key)

```bash
openssl rsa -in veriflow-private.pem -pubout -out veriflow-public.pem
```
### 5. Server-Side Implementation (Python)
#### Signing a Token (Server-Side)
```python 
import jwt
import uuid
from datetime import datetime, timezone, timedelta

# Load your Private Key
with open("veriflow-private.pem", "r") as f:
    private_key = f.read()

# Create a professional payload with standard and custom claims
payload = {
    # Standard Registered Claims
    "iss": "https://api.veriflow.com",                 # Issuer
    "sub": "user_122",                                 # Subject (User ID)
    "aud": "veriflow-mobile-scanner",                  # Audience
    "iat": datetime.now(timezone.utc).timestamp(),     # Issued At
    "exp": (datetime.now(timezone.utc) + timedelta(days=12)).timestamp(), # Expiration
    "jti": str(uuid.uuid4()),                          # Unique ID

    # Custom Business Claims
    "role": "warehouse_manager",
    "scope": "freight:read freight:scan",
    "freight": {
        "shipment_id": "SHP-9942A",
        "item_name": "1kg Box of CPU RAMs",
        "description": "Offline parcel transcriptor via VeriFlow",
        "origin": "JFK-Airport",
        "destination": "LHR-Warehouse-3"
    }
}

# Sign the token using the Private Key
token = jwt.encode(payload, private_key, algorithm="RS256")
print(f"Generated Token:\n{token}")
```
### Verifying a Token (Server-Side)
```python 
import jwt
from jwt.exceptions import InvalidTokenError

# Load the Public Key
with open("veriflow-public.pem", "r") as f:
    public_key = f.read()

# The token scanned from the QR code
scanned_token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."

try:
    # Verify the signature and check expiration
    decoded_payload = jwt.decode(scanned_token, public_key, algorithms=["RS256"])
    print("✅ Verification Passed. Payload:", decoded_payload)
except InvalidTokenError as e:
    print("❌ Verification Failed:", e)
```

### 6. Mobile App Validation (Client-Side)
The VeriFlow mobile app uses the jose library (JavaScript). The logic mirrors the Python snippet but runs entirely on the device without an internet connection.
### ```src/core/jwt.ts``` (React Native / Expo)
```typescript
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
    });

    return {
      valid: false,
      status: 'fail',
      reason: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}
```
#### Created by Talha Khalid (IOT Noob)

