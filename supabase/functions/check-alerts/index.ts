// Supabase Edge Function — runs daily after refresh-prices.
// Reads collections + watchlists with target prices, compares to latest
// pokemon_card_prices entry, sends Resend email if threshold crossed.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const COND_LABEL: Record<string, string> = {
  raw: 'Raw', psa10: 'PSA 10', psa9: 'PSA 9',
  psa8: 'PSA 8', cgc10: 'CGC 10', cgc9: 'CGC 9', sealed: 'Sealed',
}

interface Alert {
  type: 'up' | 'down'
  name: string
  setName: string | null
  condition: string
  currentPrice: number
  targetPrice: number
  dollarDiff: number
  pctDiff: number
}

Deno.serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendKey   = Deno.env.get('RESEND_KEY') ?? ''

    const sb = createClient(supabaseUrl, serviceKey)
    let emailsSent = 0

    // Get all distinct users who have cards with target prices set
    const { data: users } = await sb.auth.admin.listUsers()
    if (!users?.users) return new Response(JSON.stringify({ ok: true, emailsSent: 0 }), { headers: { 'Content-Type': 'application/json' } })

    for (const user of users.users) {
      const email = user.email
      if (!email) continue

      const alerts: Alert[] = []

      for (const table of ['collections', 'watchlists'] as const) {
        const { data: cards } = await sb
          .from(table)
          .select('id, name, set_name, condition, target_buy_price, target_sell_price')
          .eq('user_id', user.id)

        for (const card of cards ?? []) {
          if (!card.target_buy_price && !card.target_sell_price) continue

          // Get latest price for this card
          const { data: prices } = await sb
            .from('card_price_history')
            .select('price')
            .eq('card_id', card.id)
            .order('date', { ascending: false })
            .limit(1)

          const currentPrice = prices?.[0]?.price
          if (!currentPrice) continue

          // Buy alert: current <= target_buy_price (good time to buy)
          if (card.target_buy_price && currentPrice <= card.target_buy_price) {
            const dollarDiff = Math.round((card.target_buy_price - currentPrice) * 100) / 100
            const pctDiff = Math.round((dollarDiff / card.target_buy_price) * 1000) / 10
            alerts.push({ type: 'down', name: card.name, setName: card.set_name, condition: card.condition, currentPrice, targetPrice: card.target_buy_price, dollarDiff, pctDiff })
          }

          // Sell alert: current >= target_sell_price (good time to sell)
          if (card.target_sell_price && currentPrice >= card.target_sell_price) {
            const dollarDiff = Math.round((currentPrice - card.target_sell_price) * 100) / 100
            const pctDiff = Math.round((dollarDiff / card.target_sell_price) * 1000) / 10
            alerts.push({ type: 'up', name: card.name, setName: card.set_name, condition: card.condition, currentPrice, targetPrice: card.target_sell_price, dollarDiff, pctDiff })
          }
        }
      }

      if (alerts.length === 0 || !resendKey) continue

      const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      const rows = alerts.map(a => `
        <tr style="border-bottom:1px solid #2a2d36">
          <td style="padding:10px 12px;color:#e2e8f0">${esc(a.name)}${a.setName ? ` <span style="color:#94a3b8;font-size:12px">(${esc(a.setName)})</span>` : ''}</td>
          <td style="padding:10px 12px;color:#94a3b8;font-size:12px">${esc(COND_LABEL[a.condition] || a.condition)}</td>
          <td style="padding:10px 12px;color:${a.type === 'up' ? '#34d399' : '#f87171'};font-weight:600">${a.type === 'up' ? '↑ SELL ALERT' : '↓ BUY ALERT'}</td>
          <td style="padding:10px 12px;color:#e2e8f0">$${a.currentPrice.toFixed(2)}</td>
          <td style="padding:10px 12px;color:#e2e8f0">$${a.targetPrice.toFixed(2)}</td>
          <td style="padding:10px 12px;color:${a.type === 'up' ? '#34d399' : '#f87171'}">$${a.dollarDiff.toFixed(2)} (${a.pctDiff}%)</td>
        </tr>`).join('')

      const html = `<div style="background:#0f1117;color:#e2e8f0;font-family:sans-serif;padding:32px;max-width:640px;margin:0 auto;border-radius:12px">
        <p style="font-size:11px;letter-spacing:0.15em;color:#64748b;text-transform:uppercase;margin:0 0 8px">PokePrice</p>
        <h1 style="margin:0 0 8px;font-size:20px;color:#f8fafc">${alerts.length} price alert${alerts.length !== 1 ? 's' : ''} triggered</h1>
        <p style="color:#94a3b8;font-size:14px;margin:0 0 24px">The following cards crossed your target prices in the latest refresh.</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #2a2d36;border-radius:8px;overflow:hidden">
          <thead>
            <tr style="background:#1e2130">
              <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.1em">Card</th>
              <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.1em">Condition</th>
              <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.1em">Type</th>
              <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.1em">Current</th>
              <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.1em">Target</th>
              <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.1em">Difference</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="color:#475569;font-size:12px;margin:24px 0 0">Open PokePrice to view your portfolio and manage your alerts.</p>
      </div>`

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'PokePrice <alerts@pokeprice.app>',
          to: email,
          subject: `PokePrice — ${alerts.length} price alert${alerts.length !== 1 ? 's' : ''} triggered`,
          html,
        }),
      })
      if (res.ok) emailsSent++
      else console.error(`Resend failed for ${email}:`, await res.text())
    }

    return new Response(JSON.stringify({ ok: true, emailsSent }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
