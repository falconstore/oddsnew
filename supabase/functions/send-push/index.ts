import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function base64url(data: Uint8Array): string {
  const bytes = Array.from(data)
  const b64 = btoa(bytes.map(b => String.fromCharCode(b)).join(''))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function fromBase64url(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '=')
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0))
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const a of arrays) { out.set(a, off); off += a.length }
  return out
}

// ─── VAPID JWT ────────────────────────────────────────────────────────────────

async function buildVapidJwt(endpoint: string, vapidPublicB64: string, vapidPrivateB64: string): Promise<string> {
  const url = new URL(endpoint)
  const audience = `${url.protocol}//${url.host}`
  const exp = Math.floor(Date.now() / 1000) + 43200

  const enc = new TextEncoder()
  const header = base64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = base64url(enc.encode(JSON.stringify({ aud: audience, exp, sub: 'mailto:admin@sharkgreen.com.br' })))
  const signingInput = `${header}.${payload}`

  // Import private key as JWK (d = private scalar, x/y = public point coords)
  const pubBytes = fromBase64url(vapidPublicB64)  // 65 bytes: 0x04 + x(32) + y(32)
  const privKey = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC', crv: 'P-256',
      d: vapidPrivateB64,
      x: base64url(pubBytes.slice(1, 33)),
      y: base64url(pubBytes.slice(33, 65)),
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  )

  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privKey, enc.encode(signingInput))
  )
  return `${signingInput}.${base64url(sig)}`
}

// ─── RFC 8291 payload encryption using native Web Crypto HKDF ────────────────

async function encryptPayload(
  plaintext: string,
  p256dhB64: string,
  authB64: string
): Promise<Uint8Array> {
  const enc = new TextEncoder()

  const receiverPublicBytes = fromBase64url(p256dhB64)    // browser P-256 public key (65 bytes)
  const authSecret = fromBase64url(authB64)                // auth secret (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16))  // random 16-byte salt

  // Ephemeral sender ECDH key pair
  const senderKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  )
  const senderPublicBytes = new Uint8Array(
    await crypto.subtle.exportKey('raw', senderKeyPair.publicKey)
  )  // 65 bytes uncompressed

  // ECDH shared secret with receiver's public key
  const receiverKey = await crypto.subtle.importKey(
    'raw', receiverPublicBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  )
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: receiverKey }, senderKeyPair.privateKey, 256
  )
  const sharedSecret = new Uint8Array(sharedBits)

  // RFC 8291 §3.3: IKM via HKDF-Extract(auth_secret, ECDH) + HKDF-Expand with keyInfo
  // key_info = "WebPush: info\x00" || ua_public || as_public
  const keyInfo = concat(
    enc.encode('WebPush: info\x00'),
    receiverPublicBytes,
    senderPublicBytes
  )

  // Use native HKDF to derive IKM (salt=authSecret, ikm=sharedSecret, info=keyInfo, len=32)
  const sharedKey = await crypto.subtle.importKey(
    'raw', sharedSecret, 'HKDF', false, ['deriveBits']
  )
  const ikmBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: keyInfo },
    sharedKey, 256
  )
  const ikm = new Uint8Array(ikmBits)

  // RFC 8291 §3.4: CEK and nonce via HKDF(salt=random_salt, ikm=IKM)
  const ikmKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])

  const cekBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF', hash: 'SHA-256',
      salt,
      info: enc.encode('Content-Encoding: aes128gcm\x00'),
    },
    ikmKey, 128  // 16 bytes
  )

  // Derive nonce separately from same IKM (HKDF is stateless, reimport)
  const ikmKey2 = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const nonceBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF', hash: 'SHA-256',
      salt,
      info: enc.encode('Content-Encoding: nonce\x00'),
    },
    ikmKey2, 96  // 12 bytes
  )

  const cek = new Uint8Array(cekBits)
  const nonce = new Uint8Array(nonceBits)

  // AES-128-GCM encrypt: plaintext + 0x02 delimiter (RFC 8291 §4)
  const padded = concat(enc.encode(plaintext), new Uint8Array([0x02]))
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt'])
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded)
  )

  // aes128gcm record: salt(16) + rs(4 BE) + idlen(1) + keyid(senderPublic) + ciphertext
  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, 4096, false)  // record size big-endian
  const idlen = new Uint8Array([senderPublicBytes.length])  // 65

  return concat(salt, rs, idlen, senderPublicBytes, ciphertext)
}

// ─── Send one push notification ───────────────────────────────────────────────

async function sendOne(
  sub: { endpoint: string; p256dh: string; auth: string },
  payloadJson: string,
  vapidPublic: string,
  vapidPrivate: string
): Promise<void> {
  const body = await encryptPayload(payloadJson, sub.p256dh, sub.auth)
  const jwt = await buildVapidJwt(sub.endpoint, vapidPublic, vapidPrivate)

  const authHeader = `vapid t=${jwt},k=${vapidPublic}`
  console.log('[send-push] endpoint:', sub.endpoint.slice(0, 60))
  console.log('[send-push] auth header length:', authHeader.length)
  console.log('[send-push] body bytes:', body.length)

  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
      'Authorization': authHeader,
    },
    body,
  })

  const responseText = await res.text().catch(() => '')
  console.log('[send-push] FCM status:', res.status, '| body:', responseText.slice(0, 200))

  // FCM legacy endpoint returns 200 with failure in body
  if (responseText.includes('"failure":1') || responseText.includes('"error"')) {
    throw Object.assign(
      new Error(`FCM delivery failure: ${responseText.slice(0, 200)}`),
      { statusCode: res.status }
    )
  }

  if (!res.ok && res.status !== 201) {
    throw Object.assign(
      new Error(`Push failed ${res.status}: ${responseText}`),
      { statusCode: res.status }
    )
  }
}

// ─── Notification templates ───────────────────────────────────────────────────

type PushBody = {
  type: 'new_procedure' | 'daily_summary' | 'subscription_pending' | 'subscription_canceled' | 'subscription_expired' | 'custom'
  user_id?: string
  lead_id?: string
  triggered_by?: string
  title?: string
  body_text?: string
  tag?: string
  url?: string
  procedure_number?: number
  profit_loss?: number | null
  tipo?: string
  platform?: string
  freebet_value?: number | null
  duplo_green_confirmado?: boolean
  total_profit?: number
  count?: number
  freebets_count?: number
}

function buildPayload(body: PushBody): { title: string; body: string; tag: string; data: Record<string, string> } {
  const fmt = (n: number) => `R$ ${n >= 0 ? '+' : ''}${n.toFixed(2).replace('.', ',')}`

  switch (body.type) {
    case 'new_procedure': {
      const n = body.procedure_number ? ` #${body.procedure_number}` : ''
      const platform = body.platform ? ` • ${body.platform}` : ''
      return {
        title: `🦈 Novo procedimento${n}`,
        body: `${body.tipo ?? 'Procedimento'} adicionado${platform}`,
        tag: 'new_procedure',
        data: { url: '/procedures' },
      }
    }
    case 'daily_summary': {
      const profit = body.total_profit != null ? ` • ${fmt(body.total_profit)}` : ''
      return {
        title: '📊 Resumo do dia',
        body: `${body.count ?? 0} procedimentos hoje${profit}`,
        tag: 'daily_summary',
        data: { url: '/' },
      }
    }
    case 'subscription_pending':
      return { title: '⚠️ Pagamento pendente', body: 'Confirme o pagamento para manter seu acesso ativo.', tag: 'sub_pending', data: { url: '/assinatura' } }
    case 'subscription_canceled':
      return { title: '❌ Assinatura cancelada', body: 'Seu acesso foi encerrado. Renove para continuar.', tag: 'sub_canceled', data: { url: '/assinatura' } }
    case 'subscription_expired':
      return { title: '⏰ Acesso expirado', body: 'Seu trial/assinatura expirou. Renove agora.', tag: 'sub_expired', data: { url: '/assinatura' } }
    case 'custom':
    default:
      return {
        title: body.title ?? '🦈 Shark Green',
        body: body.body_text ?? '',
        tag: body.tag ?? 'custom',
        data: { url: body.url ?? '/' },
      }
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')!
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const body = await req.json() as PushBody

    // ── Build notification payload ──
    let title: string
    let bodyText: string
    let tag: string
    let url: string

    if (body.type === 'custom') {
      title = body.title ?? '🦈 Shark Green'
      bodyText = body.body_text ?? ''
      tag = body.tag ?? 'custom'
      url = body.url ?? '/'
    } else {
      const t = buildPayload(body)
      title = t.title; bodyText = t.body; tag = t.tag; url = t.data.url
    }

    const notifPayload = JSON.stringify({ title, body: bodyText, tag, data: { url } })

    // ── Fetch subscriptions ──
    let query = supabase.from('push_subscriptions').select('*')
    if (body.user_id) query = query.eq('user_id', body.user_id)
    else if (body.lead_id) query = query.eq('lead_id', body.lead_id)

    const { data: subs } = await query
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Send to each subscription ──
    let sent = 0
    const expired: string[] = []
    const errors: string[] = []

    const noPayload = (body as any).no_payload === true

    await Promise.all(subs.map(async (sub: any) => {
      try {
        if (noPayload) {
          // Diagnostic: send without encrypted payload — tests delivery + VAPID only
          const jwt = await buildVapidJwt(sub.endpoint, vapidPublic, vapidPrivate)
          const res = await fetch(sub.endpoint, {
            method: 'POST',
            headers: {
              'TTL': '86400',
              'Authorization': `vapid t=${jwt},k=${vapidPublic}`,
            },
          })
          const responseText = await res.text().catch(() => '')
          console.log('[send-push no_payload] status:', res.status, 'body:', responseText.slice(0, 200))
          if (!res.ok && res.status !== 201) {
            throw Object.assign(new Error(`Push failed ${res.status}: ${responseText}`), { statusCode: res.status })
          }
        } else {
          await sendOne(sub, notifPayload, vapidPublic, vapidPrivate)
        }
        sent++
      } catch (e: any) {
        errors.push(`${sub.endpoint.slice(-20)}: ${e.message}`)
        if (e.statusCode === 410 || e.statusCode === 404) expired.push(sub.endpoint)
      }
    }))

    // ── Cleanup expired subscriptions ──
    if (expired.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', expired)
    }

    // ── Log result ──
    try {
      await supabase.from('push_notification_logs').insert({
        type: body.type,
        title,
        body: bodyText,
        url,
        target: body.user_id ? `user:${body.user_id}` : body.lead_id ? `lead:${body.lead_id}` : 'all',
        sent_count: sent,
        error: errors.length > 0 ? errors.join(' | ') : null,
        triggered_by: body.triggered_by ?? 'api',
      })
    } catch (_) { /* log failure is non-fatal */ }

    return new Response(
      JSON.stringify({ sent, expired: expired.length, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('send-push error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
