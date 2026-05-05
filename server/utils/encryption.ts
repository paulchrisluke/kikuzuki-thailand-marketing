// Production-ready encryption utilities for connector tokens
// Uses Web Crypto API AES-GCM for secure token storage

export interface EncryptionEnv {
  CONNECTOR_TOKEN_ENCRYPTION_KEY?: string
}

// Derive 256-bit AES key from base64-encoded key
async function getEncryptionKey(env: EncryptionEnv): Promise<CryptoKey> {
  const keyString = env.CONNECTOR_TOKEN_ENCRYPTION_KEY
  if (!keyString) {
    throw new Error('CONNECTOR_TOKEN_ENCRYPTION_KEY not set')
  }
  
  // Convert base64 to Uint8Array (32 bytes = 256 bits)
  const binaryString = atob(keyString)
  const keyBytes = new Uint8Array(32)
  for (let i = 0; i < Math.min(binaryString.length, 32); i++) {
    keyBytes[i] = binaryString.charCodeAt(i)
  }
  
  // Pad with zeros if key is too short
  for (let i = binaryString.length; i < 32; i++) {
    keyBytes[i] = 0
  }
  
  return globalThis.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
}

// Encrypt secret using AES-GCM
export async function encryptSecret(plaintext: string): Promise<string> {
  const env = process.env as EncryptionEnv
  const key = await getEncryptionKey(env)
  
  // Generate random 12-byte IV
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  
  // Encode plaintext
  const dataBytes = new TextEncoder().encode(plaintext)
  
  // Encrypt
  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBytes
  )
  
  // Convert to base64 and format as versioned string
  const ivBase64 = btoa(String.fromCharCode(...iv))
  const cipherBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)))
  
  return `v1:${ivBase64}:${cipherBase64}`
}

// Decrypt secret using AES-GCM
export async function decryptSecret(value: string): Promise<string> {
  const env = process.env as EncryptionEnv
  const key = await getEncryptionKey(env)
  
  // Parse versioned format
  const parts = value.split(':')
  if (parts.length !== 3 || parts[0] !== 'v1') {
    throw new Error('Invalid encrypted value format')
  }
  
  const ivBase64 = parts[1]
  const cipherBase64 = parts[2]
  
  if (!ivBase64 || !cipherBase64) {
    throw new Error('Invalid encrypted value format: missing IV or ciphertext')
  }
  
  // Decode base64
  const ivBinary = atob(ivBase64)
  const cipherBinary = atob(cipherBase64)
  const iv = new Uint8Array(ivBinary.split('').map(c => c.charCodeAt(0)))
  const encrypted = new Uint8Array(cipherBinary.split('').map(c => c.charCodeAt(0)))
  
  // Decrypt
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  )
  
  return new TextDecoder().decode(decrypted)
}

// Self-test for encryption roundtrip
export async function testEncryption(): Promise<boolean> {
  try {
    const testText = 'test-secret-token-' + Date.now()
    const encrypted = await encryptSecret(testText)
    const decrypted = await decryptSecret(encrypted)
    
    return testText === decrypted
  } catch (error) {
    console.error('Encryption self-test failed:', error)
    return false
  }
}
