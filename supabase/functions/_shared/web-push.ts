// Web Push payload encryption (RFC 8291 / RFC 8188 aes128gcm), dependency-free WebCrypto so the
// same module runs in the Deno edge runtime and under Node for tests. Without this the worker
// could only send empty pushes, which the service worker renders as a generic "Silbo Sports
// alert" with no event details.
//
// Validated against the RFC 8291 Appendix A test vector (scripts/test-web-push.mjs).

export type PushSubscriptionKeys = {
  /** Receiver's P-256 public key, base64url (65-byte uncompressed point). */
  p256dh: string
  /** Receiver's 16-byte authentication secret, base64url. */
  auth: string
}

/** Test seam: fixed sender keypair + salt so the RFC test vector can be reproduced exactly. */
export type EncryptTestOverrides = {
  senderKeys?: CryptoKeyPair
  salt?: Uint8Array
}

const RECORD_SIZE = 4096

export function base64UrlToBytes(value: string): Uint8Array {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let raw = ''
  for (const byte of bytes) raw += String.fromCharCode(byte)
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource },
    key,
    length * 8,
  )
  return new Uint8Array(bits)
}

/**
 * Encrypt a push payload for a subscription. Returns the full aes128gcm message body
 * (header || ciphertext) to POST to the push endpoint with `Content-Encoding: aes128gcm`.
 */
export async function encryptWebPushPayload(
  subscription: PushSubscriptionKeys,
  plaintext: string,
  overrides: EncryptTestOverrides = {},
): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const uaPublic = base64UrlToBytes(subscription.p256dh)
  const authSecret = base64UrlToBytes(subscription.auth)
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('Invalid p256dh subscription key')
  if (authSecret.length !== 16) throw new Error('Invalid auth subscription secret')

  const senderKeys =
    overrides.senderKeys ??
    (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']))
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', senderKeys.publicKey))
  const salt = overrides.salt ?? crypto.getRandomValues(new Uint8Array(16))
  if (salt.length !== 16) throw new Error('Salt must be 16 bytes')

  const uaPublicKey = await crypto.subtle.importKey(
    'raw',
    uaPublic as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaPublicKey }, senderKeys.privateKey, 256),
  )

  // RFC 8291 §3.3-3.4: IKM = HKDF(auth, ecdh, "WebPush: info" || 0x00 || ua_public || as_public, 32)
  const keyInfo = concatBytes(encoder.encode('WebPush: info\0'), uaPublic, asPublic)
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32)
  const cek = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12)

  // RFC 8188 §2: single record = plaintext || 0x02 (last-record padding delimiter).
  const record = concatBytes(encoder.encode(plaintext), new Uint8Array([2]))
  const aesKey = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, aesKey, record as BufferSource),
  )

  // RFC 8188 §2.1 header: salt(16) || record_size(4, big-endian) || keyid_len(1) || keyid(as_public)
  const header = new Uint8Array(16 + 4 + 1 + asPublic.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, RECORD_SIZE)
  header[20] = asPublic.length
  header.set(asPublic, 21)

  return concatBytes(header, ciphertext)
}
