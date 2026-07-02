// Validates supabase/functions/_shared/web-push.ts against the RFC 8291 Appendix A test vector.
// Run: node --experimental-strip-types scripts/test-web-push.mjs
import { encryptWebPushPayload, base64UrlToBytes, bytesToBase64Url } from '../supabase/functions/_shared/web-push.ts'

// RFC 8291 Appendix A inputs
const UA_PUBLIC = 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'
const AUTH_SECRET = 'BTBZMqHH6r4Tts7J_aSIgg'
const AS_PUBLIC = 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'
const AS_PRIVATE = 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'
const SALT = 'DGv6ra1nlYgDCS1FRnbzlw'
const PLAINTEXT = 'When I grow up, I want to be a watermelon'
// A.5: ciphertext portion of the final message body
const EXPECTED_CIPHERTEXT = '8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ'

const asPublicBytes = base64UrlToBytes(AS_PUBLIC)
const senderJwk = {
  kty: 'EC',
  crv: 'P-256',
  d: AS_PRIVATE,
  x: bytesToBase64Url(asPublicBytes.slice(1, 33)),
  y: bytesToBase64Url(asPublicBytes.slice(33, 65)),
}
const privateKey = await crypto.subtle.importKey('jwk', senderJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, [
  'deriveBits',
])
const publicKey = await crypto.subtle.importKey(
  'raw',
  asPublicBytes,
  { name: 'ECDH', namedCurve: 'P-256' },
  true,
  [],
)

const body = await encryptWebPushPayload(
  { p256dh: UA_PUBLIC, auth: AUTH_SECRET },
  PLAINTEXT,
  { senderKeys: { privateKey, publicKey }, salt: base64UrlToBytes(SALT) },
)

// Expected: salt(16) || rs=4096(4) || keyid_len=65(1) || as_public(65) || ciphertext
const saltBytes = base64UrlToBytes(SALT)
const header = new Uint8Array(86)
header.set(saltBytes, 0)
new DataView(header.buffer).setUint32(16, 4096)
header[20] = 65
header.set(asPublicBytes, 21)
const expected = new Uint8Array([...header, ...base64UrlToBytes(EXPECTED_CIPHERTEXT)])

const got = bytesToBase64Url(body)
const want = bytesToBase64Url(expected)
if (got !== want) {
  console.error('MISMATCH\n got: %s\nwant: %s', got, want)
  process.exit(1)
}
console.log('OK: RFC 8291 test vector matches (%d-byte message body)', body.length)
