import { NextResponse } from 'next/server'

async function callAI(prompt) {
  if (process.env.CEREBRAS_API_KEY) {
    try {
      const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b',
          messages: [
            { role: 'system', content: 'You are a senior portfolio manager. Return ONLY valid JSON with no markdown.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 3000,
        }),
      })
      const data = await res.json()
      if (res.ok && data.choices?.[0]?.message?.content) {
        return parseJSON(data.choices[0].message.content)
      }
    } catch (e) {
      console.log('Cerebras failed, trying Groq...', e.message)
    }
  }

  if (process.env.GROQ_API_KEY) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a senior portfolio manager. Return ONLY valid JSON with no markdown.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || 'Groq API error')
    return parseJSON(data.choices?.[0]?.message?.content || '')
  }

  throw new Error('No AI API key configured')
}

function parseJSON(text) {
  const clean = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim()
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No valid JSON returned')
  return JSON.parse(match[0])
}

function fmt(n, d = 2) {
  if (n == null || isNaN(n)) return 'N/A'
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(d) + 'T'
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(d) + 'B'
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(d) + 'M'
  return n.toFixed(d)
}
function pct(n) { return n == null ? 'N/A' : (n * 100).toFixed(1) + '%' }

export async function POST(request) {
  try {
    const { stock1, stock2 } = await request.json()
    if (!stock1 || !stock2) return NextResponse.json({ error: 'Both stocks required' }, { status: 400 })
    if (!process.env.CEREBRAS_API_KEY && !process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'No AI API key configured' }, { status: 500 })
    }

    const prompt = `Compare ${stock1.ticker} vs ${stock2.ticker} for investment.

${stock1.ticker} (${stock1.name}): Price ${stock1.price?.toFixed(2)} ${stock1.currency||'USD'}, MCap ${fmt(stock1.marketCap)}, P/E ${stock1.pe?.toFixed(1)||'N/A'}, EV/EBITDA ${stock1.evToEbitda?.toFixed(1)||'N/A'}, Revenue ${fmt(stock1.revenue)}, Growth ${pct(stock1.revenueGrowth)}, Net Margin ${pct(stock1.profitMargin)}, ROE ${pct(stock1.roe)}, Beta ${stock1.beta?.toFixed(2)||'N/A'}

${stock2.ticker} (${stock2.name}): Price ${stock2.price?.toFixed(2)} ${stock2.currency||'USD'}, MCap ${fmt(stock2.marketCap)}, P/E ${stock2.pe?.toFixed(1)||'N/A'}, EV/EBITDA ${stock2.evToEbitda?.toFixed(1)||'N/A'}, Revenue ${fmt(stock2.revenue)}, Growth ${pct(stock2.revenueGrowth)}, Net Margin ${pct(stock2.profitMargin)}, ROE ${pct(stock2.roe)}, Beta ${stock2.beta?.toFixed(2)||'N/A'}

Return ONLY this JSON:
{
  "winner": "${stock1.ticker}",
  "winnerRationale": "2-3 sentence rationale",
  "comparisonDimensions": [
    { "dimension": "Valuation", "winner": "${stock1.ticker}", "stock1Score": 7, "stock2Score": 6, "detail": "brief detail" },
    { "dimension": "Growth", "winner": "${stock2.ticker}", "stock1Score": 6, "stock2Score": 8, "detail": "brief detail" },
    { "dimension": "Profitability", "winner": "${stock1.ticker}", "stock1Score": 8, "stock2Score": 7, "detail": "brief detail" },
    { "dimension": "Financial Health", "winner": "TIE", "stock1Score": 7, "stock2Score": 7, "detail": "brief detail" },
    { "dimension": "Momentum", "winner": "${stock2.ticker}", "stock1Score": 6, "stock2Score": 7, "detail": "brief detail" },
    { "dimension": "Income", "winner": "${stock1.ticker}", "stock1Score": 7, "stock2Score": 5, "detail": "brief detail" }
  ],
  "headToHead": [
    { "metric": "P/E Ratio", "stock1Value": "28x", "stock2Value": "32x", "advantage": "${stock1.ticker}" },
    { "metric": "Revenue Growth", "stock1Value": "12%", "stock2Value": "18%", "advantage": "${stock2.ticker}" },
    { "metric": "Net Margin", "stock1Value": "25%", "stock2Value": "20%", "advantage": "${stock1.ticker}" },
    { "metric": "ROE", "stock1Value": "35%", "stock2Value": "28%", "advantage": "${stock1.ticker}" },
    { "metric": "Beta (Risk)", "stock1Value": "1.2", "stock2Value": "1.5", "advantage": "${stock1.ticker}" },
    { "metric": "Dividend Yield", "stock1Value": "1.2%", "stock2Value": "0.5%", "advantage": "${stock1.ticker}" }
  ],
  "stock1Strengths": ["strength1", "strength2", "strength3"],
  "stock2Strengths": ["strength1", "strength2", "strength3"],
  "stock1Weaknesses": ["weakness1", "weakness2"],
  "stock2Weaknesses": ["weakness1", "weakness2"],
  "recommendation": {
    "forGrowthInvestors": "${stock2.ticker}",
    "growthRationale": "rationale",
    "forValueInvestors": "${stock1.ticker}",
    "valueRationale": "rationale",
    "forIncomeInvestors": "${stock1.ticker}",
    "incomeRationale": "rationale"
  },
  "portfolioContext": "2-3 sentences on portfolio fit"
}`

    const data = await callAI(prompt)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[compare] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Comparison failed' }, { status: 500 })
  }
}
