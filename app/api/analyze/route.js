import { NextResponse } from 'next/server'

// ─── AI caller — tries Cerebras first, falls back to Groq ─────────────────
async function callAI(systemPrompt, userPrompt) {
  // Try Cerebras first (1M tokens/day free)
  if (process.env.CEREBRAS_API_KEY) {
    try {
      const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama3.3-70b',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4096,
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

  // Fallback to Groq
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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || 'Groq API error')
    return parseJSON(data.choices?.[0]?.message?.content || '')
  }

  throw new Error('No AI API key configured. Add CEREBRAS_API_KEY or GROQ_API_KEY to .env.local')
}

function parseJSON(text) {
  const clean = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim()
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No valid JSON returned from AI')
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

function buildThesisPrompt(ticker, d) {
  return {
    system: 'You are a senior equity analyst at a top hedge fund. Return ONLY valid JSON with no markdown, no explanation outside the JSON.',
    user: `Analyze ${ticker} (${d.name}), trading at ${d.price?.toFixed(2)} ${d.currency || 'USD'} (${d.changePercent?.toFixed(2)}% today).

Financials: Market Cap ${fmt(d.marketCap)}, P/E ${d.pe?.toFixed(1)||'N/A'}, Forward P/E ${d.forwardPE?.toFixed(1)||'N/A'}, EV/EBITDA ${d.evToEbitda?.toFixed(1)||'N/A'}
Revenue ${fmt(d.revenue)}, EBITDA ${fmt(d.ebitda)}, FCF ${fmt(d.freeCashFlow)}
Net Margin ${pct(d.profitMargin)}, Gross Margin ${pct(d.grossMargin)}, ROE ${pct(d.roe)}
Revenue Growth ${pct(d.revenueGrowth)}, D/E ${d.debtToEquity?.toFixed(2)||'N/A'}x, Beta ${d.beta?.toFixed(2)||'N/A'}
52W: ${d.weekLow52?.toFixed(2)} - ${d.weekHigh52?.toFixed(2)}, Analyst Target ${d.targetMeanPrice?.toFixed(2)||'N/A'}, Consensus ${d.recommendationKey||'N/A'}
Sector: ${d.sector}, Industry: ${d.industry}
${d.description ? 'Business: ' + d.description.substring(0, 300) : ''}

Return ONLY this JSON:
{
  "verdict": "BUY",
  "confidence": 75,
  "targetPrice": 200.00,
  "upsideDownside": 15.5,
  "timeHorizon": "12-18 months",
  "thesisSummary": "2-3 sentence executive summary",
  "bullCase": { "title": "string", "points": ["point1","point2","point3"], "targetPrice": 220.00, "probability": 40 },
  "bearCase": { "title": "string", "points": ["point1","point2","point3"], "targetPrice": 150.00, "probability": 25 },
  "baseCase": { "title": "string", "targetPrice": 195.00, "probability": 35 },
  "keyDrivers": [
    { "driver": "string", "impact": "POSITIVE", "detail": "string" },
    { "driver": "string", "impact": "NEGATIVE", "detail": "string" },
    { "driver": "string", "impact": "POSITIVE", "detail": "string" }
  ],
  "moatRating": 4.0,
  "moatType": "Network Effects",
  "growthQuality": "1-2 sentences on quality of growth",
  "catalysts": ["catalyst1", "catalyst2", "catalyst3"],
  "risks": ["risk1", "risk2", "risk3"],
  "positionSizing": "Overweight",
  "comparisonPeers": ["PEER1", "PEER2", "PEER3"]
}`
  }
}

function buildDCFPrompt(ticker, d) {
  return {
    system: 'You are a CFA charterholder and senior financial modeler. Return ONLY valid JSON with no markdown.',
    user: `Build a 5-year DCF model for ${ticker} (${d.name}).

Current Price: ${d.price?.toFixed(2)} ${d.currency||'USD'}, Revenue: ${fmt(d.revenue)}, EBITDA: ${fmt(d.ebitda)}, FCF: ${fmt(d.freeCashFlow)}
Margins: Gross ${pct(d.grossMargin)}, Operating ${pct(d.operatingMargin)}, Net ${pct(d.profitMargin)}
Growth: Revenue ${pct(d.revenueGrowth)}, EPS ${pct(d.earningsGrowth)}
Balance: Debt ${fmt(d.totalDebt)}, Cash ${fmt(d.totalCash)}, Shares ${fmt(d.sharesOutstanding)}
Beta: ${d.beta?.toFixed(2)||'1.0'}, D/E: ${d.debtToEquity?.toFixed(2)||'N/A'}, Sector: ${d.sector}
Use risk-free rate 4.5%, market risk premium 5.5%.

Return ONLY this JSON (use realistic numbers based on the actual financials):
{
  "assumptions": { "wacc": 10.5, "terminalGrowthRate": 3.0, "riskFreeRate": 4.5, "marketRiskPremium": 5.5, "taxRate": 21.0, "capexAsRevenuePercent": 5.0, "nwcChangeAsRevenuePercent": 2.0, "revenueGrowthRates": [15.0, 12.0, 10.0, 8.0, 6.0], "ebitdaMargins": [30.0, 31.0, 32.0, 33.0, 34.0], "depreciation": 5.0 },
  "projections": [
    { "year": 1, "revenue": 100000000, "ebitda": 30000000, "ebit": 25000000, "nopat": 19750000, "capex": 5000000, "nwcChange": 2000000, "fcf": 12750000 },
    { "year": 2, "revenue": 112000000, "ebitda": 34720000, "ebit": 29120000, "nopat": 23005000, "capex": 5600000, "nwcChange": 2240000, "fcf": 15165000 },
    { "year": 3, "revenue": 123200000, "ebitda": 39424000, "ebit": 33024000, "nopat": 26089000, "capex": 6160000, "nwcChange": 2464000, "fcf": 17465000 },
    { "year": 4, "revenue": 133056000, "ebitda": 43908000, "ebit": 36708000, "nopat": 28999000, "capex": 6653000, "nwcChange": 2661000, "fcf": 19685000 },
    { "year": 5, "revenue": 141039000, "ebitda": 48033000, "ebit": 40233000, "nopat": 31784000, "capex": 7052000, "nwcChange": 2821000, "fcf": 21911000 }
  ],
  "pvFCFs": 70000000,
  "terminalValue": 300000000,
  "pvTerminalValue": 186000000,
  "enterpriseValue": 256000000,
  "equityValue": 240000000,
  "intrinsicValuePerShare": 185.00,
  "currentPrice": ${d.price?.toFixed(2)||100},
  "marginOfSafety": 7.1,
  "upside": 7.1,
  "dcfRating": "FAIRLY VALUED",
  "sensitivityTable": {
    "waccRange": [8.5, 9.5, 10.5, 11.5, 12.5],
    "tgrRange": [2.0, 2.5, 3.0, 3.5, 4.0],
    "values": [
      [210.0, 195.0, 182.0, 170.0, 160.0],
      [220.0, 205.0, 190.0, 178.0, 167.0],
      [232.0, 215.0, 200.0, 186.0, 175.0],
      [245.0, 227.0, 210.0, 196.0, 183.0],
      [260.0, 240.0, 222.0, 207.0, 193.0]
    ]
  },
  "keyRisksToModel": ["risk1", "risk2", "risk3"],
  "analystNote": "2-3 sentence commentary on DCF result"
}`
  }
}

function buildRiskPrompt(ticker, d) {
  return {
    system: 'You are a quantitative risk analyst at a hedge fund. Return ONLY valid JSON with no markdown.',
    user: `Analyze risk and ratios for ${ticker} (${d.name}).

Price ${d.price?.toFixed(2)} ${d.currency||'USD'}, Beta ${d.beta?.toFixed(2)||'N/A'}, Short Float ${pct(d.shortPercentOfFloat)}
P/E ${d.pe?.toFixed(1)||'N/A'}, Forward P/E ${d.forwardPE?.toFixed(1)||'N/A'}, EV/EBITDA ${d.evToEbitda?.toFixed(1)||'N/A'}, P/B ${d.priceToBook?.toFixed(2)||'N/A'}, P/S ${d.priceToSales?.toFixed(2)||'N/A'}
ROE ${pct(d.roe)}, ROA ${pct(d.roa)}, Gross Margin ${pct(d.grossMargin)}, Net Margin ${pct(d.profitMargin)}
D/E ${d.debtToEquity?.toFixed(2)||'N/A'}x, Current Ratio ${d.currentRatio?.toFixed(2)||'N/A'}, Quick Ratio ${d.quickRatio?.toFixed(2)||'N/A'}
52W ${d.weekLow52?.toFixed(2)}-${d.weekHigh52?.toFixed(2)}, 50DMA ${d.fiftyDayAverage?.toFixed(2)||'N/A'}, 200DMA ${d.twoHundredDayAverage?.toFixed(2)||'N/A'}
Sector: ${d.sector}

Return ONLY this JSON:
{
  "valuationRatios": [
    { "metric": "P/E (TTM)", "value": "28.5x", "sectorMedian": "25x", "assessment": "FAIR", "note": "brief note" },
    { "metric": "Forward P/E", "value": "24x", "sectorMedian": "22x", "assessment": "FAIR", "note": "brief note" },
    { "metric": "EV/EBITDA", "value": "18x", "sectorMedian": "15x", "assessment": "EXPENSIVE", "note": "brief note" },
    { "metric": "P/S (TTM)", "value": "6x", "sectorMedian": "5x", "assessment": "FAIR", "note": "brief note" },
    { "metric": "P/B", "value": "12x", "sectorMedian": "8x", "assessment": "EXPENSIVE", "note": "brief note" }
  ],
  "qualityRatios": [
    { "metric": "ROE", "value": "35%", "benchmark": ">15% excellent", "rating": "EXCELLENT" },
    { "metric": "ROA", "value": "18%", "benchmark": ">10% excellent", "rating": "EXCELLENT" },
    { "metric": "Gross Margin", "value": "72%", "benchmark": ">50% excellent", "rating": "EXCELLENT" },
    { "metric": "Net Margin", "value": "55%", "benchmark": ">20% excellent", "rating": "EXCELLENT" },
    { "metric": "FCF Conversion", "value": "85%", "benchmark": ">70% excellent", "rating": "EXCELLENT" }
  ],
  "leverageRatios": [
    { "metric": "D/E Ratio", "value": "0.4x", "threshold": "<1x safe", "risk": "LOW" },
    { "metric": "Current Ratio", "value": "2.1x", "threshold": ">1.5x safe", "risk": "LOW" },
    { "metric": "Quick Ratio", "value": "1.8x", "threshold": ">1x safe", "risk": "LOW" },
    { "metric": "Interest Coverage", "value": "45x", "threshold": ">3x safe", "risk": "LOW" }
  ],
  "technicals": {
    "priceVs50DMA": 2.5,
    "priceVs200DMA": 8.3,
    "weekPosition52": 69,
    "trend": "UPTREND",
    "momentum": "MODERATE",
    "technicalRating": "BULLISH",
    "keyLevels": { "support": 160.00, "resistance": 195.00 }
  },
  "riskFactors": [
    { "risk": "Risk name", "severity": "HIGH", "likelihood": "MEDIUM", "detail": "detailed explanation" },
    { "risk": "Risk name", "severity": "MEDIUM", "likelihood": "LOW", "detail": "detailed explanation" },
    { "risk": "Risk name", "severity": "MEDIUM", "likelihood": "MEDIUM", "detail": "detailed explanation" }
  ],
  "overallRiskScore": 4.5,
  "overallQualityScore": 8.5,
  "riskSummary": "2-3 sentence overall risk summary",
  "peerBenchmarks": [
    { "ticker": "PEER1", "name": "Peer Company", "pe": "25x", "evEbitda": "15x", "margin": "45%" },
    { "ticker": "PEER2", "name": "Peer Company", "pe": "30x", "evEbitda": "18x", "margin": "38%" },
    { "ticker": "PEER3", "name": "Peer Company", "pe": "22x", "evEbitda": "12x", "margin": "52%" }
  ]
}`
  }
}

function buildNewsPrompt(ticker, d) {
  return {
    system: 'You are a market intelligence analyst. Return ONLY valid JSON with no markdown.',
    user: `Analyze market sentiment for ${ticker} (${d.name}).

Price ${d.price?.toFixed(2)} ${d.currency||'USD'}, Today ${d.changePercent?.toFixed(2)}%
Analyst Consensus: ${d.recommendationKey||'N/A'} (${d.numberOfAnalysts||'N/A'} analysts)
Target: ${d.targetLowPrice?.toFixed(2)||'N/A'}-${d.targetHighPrice?.toFixed(2)||'N/A'} (Mean ${d.targetMeanPrice?.toFixed(2)||'N/A'})
Short Interest: ${pct(d.shortPercentOfFloat)}, Revenue Growth: ${pct(d.revenueGrowth)}, EPS Growth: ${pct(d.earningsGrowth)}
Sector: ${d.sector}, Industry: ${d.industry}

Return ONLY this JSON:
{
  "sentimentScore": 65,
  "sentimentLabel": "BULLISH",
  "sentimentRationale": "2-3 sentence rationale",
  "analystConsensus": {
    "rating": "Buy",
    "meanTarget": 195.00,
    "upside": 13.0,
    "numAnalysts": 45,
    "buyCount": 30,
    "holdCount": 12,
    "sellCount": 3,
    "noteOnConsensus": "brief note"
  },
  "keyThemes": [
    { "theme": "Theme name", "sentiment": "POSITIVE", "detail": "detail", "timeframe": "Near-term" },
    { "theme": "Theme name", "sentiment": "NEGATIVE", "detail": "detail", "timeframe": "Medium-term" },
    { "theme": "Theme name", "sentiment": "POSITIVE", "detail": "detail", "timeframe": "Long-term" }
  ],
  "bullCatalysts": [
    { "catalyst": "Catalyst name", "probability": "HIGH", "potentialImpact": "impact" },
    { "catalyst": "Catalyst name", "probability": "MEDIUM", "potentialImpact": "impact" }
  ],
  "bearCatalysts": [
    { "catalyst": "Catalyst name", "probability": "MEDIUM", "potentialImpact": "impact" },
    { "catalyst": "Catalyst name", "probability": "LOW", "potentialImpact": "impact" }
  ],
  "macroExposure": [
    { "factor": "Interest Rates", "exposure": "NEGATIVE", "detail": "explanation" },
    { "factor": "USD Strength", "exposure": "NEUTRAL", "detail": "explanation" },
    { "factor": "Sector Tailwinds", "exposure": "POSITIVE", "detail": "explanation" }
  ],
  "institutionalActivity": {
    "shortInterestTrend": "Declining",
    "shortSqueezeRisk": "LOW",
    "institutionalOwnershipNote": "brief note"
  },
  "upcomingEvents": [
    { "event": "Quarterly Earnings", "expectedDate": "Next quarter", "marketImplications": "implications" },
    { "event": "Product/Policy Event", "expectedDate": "H2 2025", "marketImplications": "implications" }
  ],
  "tradingNote": "2-3 sentence tactical note for next 30-60 days"
}`
  }
}

export async function POST(request) {
  try {
    const { ticker, analysisType, stockData } = await request.json()

    if (!ticker || !analysisType || !stockData) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!process.env.CEREBRAS_API_KEY && !process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'No AI API key configured. Add CEREBRAS_API_KEY or GROQ_API_KEY to .env.local' }, { status: 500 })
    }

    let prompt
    switch (analysisType) {
      case 'thesis': prompt = buildThesisPrompt(ticker, stockData); break
      case 'dcf':    prompt = buildDCFPrompt(ticker, stockData); break
      case 'risk':   prompt = buildRiskPrompt(ticker, stockData); break
      case 'news':   prompt = buildNewsPrompt(ticker, stockData); break
      default: return NextResponse.json({ error: 'Invalid analysis type' }, { status: 400 })
    }

    const analysisData = await callAI(prompt.system, prompt.user)
    return NextResponse.json({ success: true, data: analysisData, analysisType })
  } catch (error) {
    console.error('[analyze] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Analysis failed. Please try again.' }, { status: 500 })
  }
}
