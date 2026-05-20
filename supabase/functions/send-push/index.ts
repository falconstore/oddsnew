import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Web Crypto helpers ──────────────────────────────────────────────────────

function base64url(data: Uint8Array): string {
  let b64 = btoa(String.fromCharCode(...data))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '=')
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0))
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) { out.set(a, offset); offset += a.length }
  return out
}

function numToUint8(n: number, byteLen: number): Uint8Array {
  const arr = new Uint8Array(byteLen)
  for (let i = byteLen - 1; i >= 0; i--) { arr[i] = n & 0xff; n >>= 8 }
  return arr
}

// HKDF extract (RFC 5869)
async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<CryptoKey> {
  const saltKey = await crypto.subtle.importKey('raw', salt.length > 0 ? salt : new Uint8Array(32), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const prk = await crypto.subtle.sign('HMAC', saltKey, ikm)
  return crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}

// HKDF expand (RFC 5869)
async function hkdfExpand(prk: CryptoKey, info: Uint8Array, length: number): Promise<Uint8Array> {
  const blocks: Uint8Array[] = []
  let t = new Uint8Array(0)
  for (let i = 1; blocks.reduce((s, b) => s + b.length, 0) < length; i++) {
    const input = concat(t, info, new Uint8Array([i]))
    t = new Uint8Array(await crypto.subtle.sign('HMAC', prk, input))
    blocks.push(t)
  }
  return concat(...blocks).slice(0, length)
}

// ─── VAPID JWT signing ───────────────────────────────────────────────────────

async function buildVapidHeader(endpoint: string, vapidPublicB64: string, vapidPrivateB64: string): Promise<string> {
  const url = new URL(endpoint)
  const audience = `${url.protocol}//${url.host}`
  const exp = Math.floor(Date.now() / 1000) + 43200 // 12h

  const enc = new TextEncoder()
  const headerB64 = base64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payloadB64 = base64url(enc.encode(JSON.stringify({ aud: audience, exp, sub: 'mailto:admin@sharkgreen.com.br' })))
  const sigInput = `${headerB64}.${payloadB64}`

  const pubBytes = base64urlDecode(vapidPublicB64)
  const privKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: vapidPrivateB64, x: base64url(pubBytes.slice(1, 33)), y: base64url(pubBytes.slice(33, 65)) },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  )
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privKey, enc.encode(sigInput)))
  const jwt = `${sigInput}.${base64url(sig)}`
  return `vapid t=${jwt},k=${vapidPublicB64}`
}

// ─── RFC 8291: Encrypted Content-Encoding for HTTP ──────────────────────────

async function encryptPayload(plaintext: string, p256dhB64: string, authB64: string): Promise<{ body: Uint8Array; salt: Uint8Array; senderPublic: Uint8Array }> {
  const enc = new TextEncoder()
  const plaintextBytes = enc.encode(plaintext)

  const receiverPublicBytes = base64urlDecode(p256dhB64)
  const authSecret = base64urlDecode(authB64)
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // Ephemeral sender key pair
  const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const senderPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey))

  // Import receiver's public key
  const receiverKey = await crypto.subtle.importKey('raw', receiverPublicBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, [])

  // ECDH shared secret
  const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverKey }, ephemeral.privateKey, 256)
  const sharedSecret = new Uint8Array(sharedBits)

  // Key info (RFC 8291 §3.4)
  const keyInfo = concat(enc.encode('WebPush: info\x00'), receiverPublicBytes, senderPublic)

  // PRK via HKDF
  const prk = await hkdfExtract(authSecret, sharedSecret)
  const ikm = await hkdfExpand(prk, keyInfo, 32)

  // CEK + nonce via HKDF with salt
  const prkCek = await hkdfExtract(salt, ikm)
  const cek = await hkdfExpand(prkCek, enc.encode('Content-Encoding: aes128gcm\x00'), 16)
  const nonce = await hkdfExpand(prkCek, enc.encode('Content-Encoding: nonce\x00'), 12)

  // AES-128-GCM encrypt (pad with 0x02 delimiter, no padding)
  const padded = concat(plaintextBytes, new Uint8Array([0x02]))
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt'])
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded))

  // Build aes128gcm body: salt(16) + rs(4) + keylen(1) + senderPublic(65) + ciphertext
  const rs = numToUint8(4096, 4)
  const keyLen = new Uint8Array([senderPublic.length])
  const body = concat(salt, rs, keyLen, senderPublic, encrypted)

  return { body, salt, senderPublic }
}

// ─── Send a single push notification ────────────────────────────────────────

async function sendOne(sub: { endpoint: string; p256dh: string; auth: string }, payloadJson: string, vapidPublic: string, vapidPrivate: string): Promise<void> {
  const { body } = await encryptPayload(payloadJson, sub.p256dh, sub.auth)
  const vapidHeader = await buildVapidHeader(sub.endpoint, vapidPublic, vapidPrivate)

  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
      'Authorization': vapidHeader,
    },
    body,
  })

  if (!res.ok && res.status !== 201) {
    const text = await res.text().catch(() => '')
    throw Object.assign(new Error(`Push failed: ${res.status} ${text}`), { statusCode: res.status })
  }
}

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')!
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const body = await req.json() as {
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

    let title = body.title ?? 'Shark Green 🦈'
    let bodyText = body.body_text ?? ''
    let tag = body.tag ?? 'sg'
    let url = body.url ?? '/'

    if (body.type === 'new_procedure') {
      const isDG = body.duplo_green_confirmado
      const isFB = body.tipo === 'GANHAR_FB' || body.tipo === 'QUEIMAR_FB'
      const profit = body.profit_loss ? Math.abs(body.profit_loss) : null
      if (isDG) {
        title = '⚡ Duplo Green confirmado!'; bodyText = body.platform ? `${body.platform} — 2× Green garantido` : 'Confira o resultado'; url = '/duplo-green'; tag = 'dg'
      } else if (isFB && body.freebet_value) {
        title = `🎯 Freebet de R$${body.freebet_value.toFixed(0)} disponível`; bodyText = body.platform ? `Queime em ${body.platform}` : 'Acesse o procedimento'; url = '/procedimentos'; tag = 'fb'
      } else if (profit) {
        title = `💰 Lucro: +R$${profit.toFixed(0)}`; bodyText = body.platform ? `via ${body.platform}` : 'Resultado confirmado'; url = '/procedimentos'; tag = `proc-${body.procedure_number}`
      } else {
        title = `📋 Procedimento #${body.procedure_number ?? ''}`; bodyText = body.platform ? `${body.platform} — ${body.tipo ?? ''}` : 'Novo procedimento'; url = '/procedimentos'; tag = 'proc'
      }
    } else if (body.type === 'daily_summary') {
      let totalProfit = body.total_profit
      let count = body.count
      let freebetsCount = body.freebets_count
      if (totalProfit === undefined || count === undefined) {
        const todayBRT = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
        const { data: procs } = await supabase.from('procedures').select('profit_loss,resultado_lucro,duplo_green_lucro,freebet_creditada').eq('date', todayBRT).eq('archived', false).eq('tachado', false)
        if (procs) {
          count = procs.length
          totalProfit = procs.reduce((s: number, p: any) => s + (p.duplo_green_lucro != null ? Number(p.duplo_green_lucro) : p.resultado_lucro != null ? Number(p.resultado_lucro) : Number(p.profit_loss ?? 0)), 0)
          freebetsCount = procs.filter((p: any) => p.freebet_creditada === 'SIM').length
        }
      }
      totalProfit = totalProfit ?? 0; count = count ?? 0; freebetsCount = freebetsCount ?? 0
      if (count === 0) return new Response(JSON.stringify({ sent: 0, reason: 'no procedures today' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      const sign = totalProfit >= 0 ? '+' : ''
      title = `📊 Fechamento: ${sign}R$${Math.abs(totalProfit).toFixed(0)} hoje`
      bodyText = `${count} procedimento${count !== 1 ? 's' : ''} · ${freebetsCount} freebet${freebetsCount !== 1 ? 's' : ''} ganha${freebetsCount !== 1 ? 's' : ''}`
      url = '/'; tag = 'daily-summary'
    } else if (body.type === 'subscription_pending') {
      title = '⚠️ Pagamento pendente'; bodyText = 'Confirme o pagamento para manter seu acesso ativo.'; url = '/assinatura'; tag = 'sub-pending'
    } else if (body.type === 'subscription_canceled') {
      title = '😢 Assinatura cancelada'; bodyText = 'Seu acesso foi encerrado. Renove para continuar.'; url = '/assinatura'; tag = 'sub-canceled'
    } else if (body.type === 'subscription_expired') {
      title = '⌛ Pedido expirado'; bodyText = 'Complete o pagamento para ativar seu acesso.'; url = '/assinatura'; tag = 'sub-expired'
    }

    // Resolve subscriptions
    let query = supabase.from('push_subscriptions').select('*')
    if (body.user_id) query = query.eq('user_id', body.user_id)
    else if (body.lead_id) query = query.eq('lead_id', body.lead_id)
    const { data: subs, error } = await query

    if (error) throw error
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no subscriptions' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const payloadJson = JSON.stringify({ title, body: bodyText, tag, data: { url } })
    let sent = 0
    const expired: string[] = []

    await Promise.allSettled(subs.map(async (sub: any) => {
      try {
        await sendOne({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payloadJson, vapidPublic, vapidPrivate)
        sent++
      } catch (e: any) {
        if (e.statusCode === 410 || e.statusCode === 404) expired.push(sub.endpoint)
      }
    }))

    if (expired.length > 0) await supabase.from('push_subscriptions').delete().in('endpoint', expired)

    try {
      await supabase.from('push_notification_logs').insert({
        type: body.type,
        title,
        body: bodyText,
        url,
        target: body.user_id ? `user:${body.user_id}` : body.lead_id ? `lead:${body.lead_id}` : 'all',
        sent_count: sent,
        triggered_by: body.triggered_by ?? 'api',
      })
    } catch (_) { /* log failure is non-fatal */ }

    return new Response(JSON.stringify({ sent, expired: expired.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
