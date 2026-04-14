'use client'
import { useState } from 'react'

import { strictValidateTicker } from '@/lib/security'

function formatNum(n, sym = '$') {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  if (Math.abs(n) >= 1e12) return sym + (n / 1e12).toFixed(2) + 'T'
  if (Math.abs(n) >= 1e9) return sym + (n / 1e9).toFixed(2) + 'B'
  if (Math.abs(n) >= 1e6) return sym + (n / 1e6).toFixed(2) + 'M'
  return sym + n.toFixed(2)
}

function getCurrencySymbol(currency) {
  const map = { INR: '₹', GBP: '£', EUR: '€', JPY: '¥' }
  return map[currency] || '$'
}

export default function ExportPDF({ stockData, analysisData, activeTab }) {
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const handleExport = async () => {
    if (!stockData) return
    setExporting(true)
    setError('')

    try {
      // Load jsPDF from CDN to avoid bundling issues
      if (!window.jspdf) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
          script.onload = resolve
          script.onerror = reject
          document.head.appendChild(script)
        })
      }

      const { jsPDF } = window.jspdf
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const W = doc.internal.pageSize.getWidth()
      const margin = 40
      let y = margin
      const sym = getCurrencySymbol(stockData.currency)

      // ─── Helpers ───────────────────────────────────────────────────────
      const addText = (text, x, yPos, size = 10, color = [180, 200, 220], bold = false, maxW = W - margin * 2) => {
        doc.setFontSize(size)
        doc.setTextColor(...color)
        doc.setFont('helvetica', bold ? 'bold' : 'normal')
        const lines = doc.splitTextToSize(String(text || ''), maxW)
        doc.text(lines, x, yPos)
        return yPos + lines.length * (size * 1.45)
      }

      const checkPage = (needed = 60) => {
        if (y + needed > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage()
          // dark bg on new page
          doc.setFillColor(7, 9, 13)
          doc.rect(0, 0, W, doc.internal.pageSize.getHeight(), 'F')
          y = margin
        }
      }

      const hr = (yPos) => {
        doc.setDrawColor(0, 80, 65)
        doc.setLineWidth(0.5)
        doc.line(margin, yPos, W - margin, yPos)
        return yPos + 12
      }

      // ─── Background ────────────────────────────────────────────────────
      doc.setFillColor(7, 9, 13)
      doc.rect(0, 0, W, doc.internal.pageSize.getHeight(), 'F')

      // ─── Top accent bar ────────────────────────────────────────────────
      doc.setFillColor(0, 212, 170)
      doc.rect(0, 0, W, 4, 'F')

      // ─── Header ────────────────────────────────────────────────────────
      y = 30
      y = addText('AlphaLens AI', margin, y, 22, [0, 212, 170], true)
      y = addText('Institutional Equity Research Report', margin, y + 2, 9, [100, 140, 170])
      y = addText(`Generated: ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}`, margin, y + 2, 8, [60, 90, 110])
      y += 10

      // ─── Stock card ────────────────────────────────────────────────────
      doc.setFillColor(15, 21, 32)
      doc.roundedRect(margin, y, W - margin * 2, 95, 4, 4, 'F')
      y += 14

      y = addText(`${stockData.ticker} — ${stockData.name}`, margin + 12, y, 15, [232, 242, 252], true)
      if (stockData.sector) {
        y = addText(`${stockData.sector} · ${stockData.industry || ''}`, margin + 12, y + 2, 8, [100, 140, 170])
      }

      const isPos = stockData.changePercent >= 0
      const priceColor = isPos ? [34, 197, 94] : [239, 68, 68]
      y = addText(
        `${sym}${stockData.price?.toFixed(2)}   ${isPos ? '+' : ''}${stockData.changePercent?.toFixed(2)}%`,
        margin + 12, y + 8, 18, priceColor, true
      )
      y += 18

      y = hr(y)

      // ─── Key stats grid ────────────────────────────────────────────────
      const stats = [
        ['Market Cap', formatNum(stockData.marketCap, sym)],
        ['P/E (TTM)', stockData.pe?.toFixed(1) || '—'],
        ['EV/EBITDA', stockData.evToEbitda?.toFixed(1) || '—'],
        ['ROE', (stockData.roe !== null && stockData.roe !== undefined && !Number.isNaN(stockData.roe)) ? (stockData.roe * 100).toFixed(1) + '%' : '—'],
        ['Net Margin', stockData.profitMargin ? (stockData.profitMargin * 100).toFixed(1) + '%' : '—'],
        ['Revenue', formatNum(stockData.revenue, sym)],
        [`FCF (FY${stockData._fcfPeriod || 'TTM'})`, formatNum(stockData.freeCashFlow, sym)],
        ['Beta', stockData.beta?.toFixed(2) || '—'],
      ]

      const colW = (W - margin * 2) / 4
      stats.forEach(([label, val], i) => {
        const col = i % 4
        if (col === 0 && i > 0) { y += 28; checkPage(30) }
        const x = margin + col * colW
        doc.setFontSize(7)
        doc.setTextColor(80, 110, 130)
        doc.text(label.toUpperCase(), x, y)
        doc.setFontSize(10)
        doc.setTextColor(200, 220, 240)
        doc.text(String(val), x, y + 13)
      })
      y += 35

      y = hr(y)

      // ─── Analysis section ──────────────────────────────────────────────
      const tabLabels = { thesis: 'Investment Thesis', dcf: 'DCF Valuation', risk: 'Risk & Ratios', news: 'News Sentiment' }
      checkPage()
      y = addText(`AI Analysis: ${tabLabels[activeTab] || activeTab}`, margin, y + 5, 13, [0, 212, 170], true)
      y += 4
      y = hr(y)

      if (analysisData) {
        const d = analysisData

        if (activeTab === 'thesis') {
          const vColor = d.verdict === 'BUY' ? [34, 197, 94] : d.verdict === 'SELL' ? [239, 68, 68] : [245, 158, 11]
          y = addText(`Verdict: ${d.verdict}`, margin, y + 5, 14, vColor, true)
          y = addText(`Target: ${sym}${d.targetPrice?.toFixed(2)} · Upside: ${d.upsideDownside?.toFixed(1)}% · Confidence: ${d.confidence}% · Horizon: ${d.timeHorizon}`, margin, y + 4, 9, [140, 180, 200])
          if (d.thesisSummary) {
            checkPage()
            y = addText('Summary:', margin, y + 12, 10, [0, 212, 170], true)
            y = addText(d.thesisSummary, margin + 10, y + 4, 9, [160, 190, 210])
          }
          if (d.bullCase) {
            checkPage()
            y = addText(`Bull Case: ${d.bullCase.title}`, margin, y + 12, 10, [34, 197, 94], true)
            d.bullCase.points?.forEach(p => { checkPage(18); y = addText(`• ${p}`, margin + 10, y + 4, 8, [120, 160, 190]) })
          }
          if (d.bearCase) {
            checkPage()
            y = addText(`Bear Case: ${d.bearCase.title}`, margin, y + 12, 10, [239, 68, 68], true)
            d.bearCase.points?.forEach(p => { checkPage(18); y = addText(`• ${p}`, margin + 10, y + 4, 8, [120, 160, 190]) })
          }
          if (d.catalysts?.length) {
            checkPage()
            y = addText('Key Catalysts:', margin, y + 12, 10, [0, 212, 170], true)
            d.catalysts.forEach(c => { checkPage(18); y = addText(`• ${c}`, margin + 10, y + 4, 8, [120, 160, 190]) })
          }
          if (d.risks?.length) {
            checkPage()
            y = addText('Key Risks:', margin, y + 12, 10, [245, 158, 11], true)
            d.risks.forEach(r => { checkPage(18); y = addText(`• ${r}`, margin + 10, y + 4, 8, [120, 160, 190]) })
          }

        } else if (activeTab === 'dcf') {
          y = addText(`Intrinsic Value: ${sym}${d.intrinsicValuePerShare?.toFixed(2)}`, margin, y + 5, 14, [0, 212, 170], true)
          y = addText(`Current Price: ${sym}${d.currentPrice?.toFixed(2)} · Upside: ${d.upside >= 0 ? '+' : ''}${d.upside?.toFixed(1)}% · Rating: ${d.dcfRating}`, margin, y + 4, 9, [140, 180, 200])
          y = addText(`WACC: ${d.assumptions?.wacc?.toFixed(1)}% · Terminal Growth: ${d.assumptions?.terminalGrowthRate?.toFixed(1)}% · Tax Rate: ${d.assumptions?.taxRate?.toFixed(1)}%`, margin, y + 4, 9, [140, 180, 200])
          if (d.analystNote) {
            checkPage()
            y = addText('Analyst Note:', margin, y + 12, 10, [0, 212, 170], true)
            y = addText(d.analystNote, margin + 10, y + 4, 9, [160, 190, 210])
          }
          if (d.projections?.length) {
            checkPage(120)
            y = addText('5-Year Projections:', margin, y + 12, 10, [0, 212, 170], true)
            d.projections.forEach(p => {
              checkPage(18)
              y = addText(`Year ${p.year}: Revenue ${formatNum(p.revenue, sym)} · EBITDA ${formatNum(p.ebitda, sym)} · FCF ${formatNum(p.fcf, sym)}`, margin + 10, y + 5, 8, [130, 165, 195])
            })
          }
          if (d.keyRisksToModel?.length) {
            checkPage()
            y = addText('Risks to Model:', margin, y + 12, 10, [245, 158, 11], true)
            d.keyRisksToModel.forEach(r => { checkPage(18); y = addText(`• ${r}`, margin + 10, y + 4, 8, [120, 160, 190]) })
          }

        } else if (activeTab === 'risk') {
          y = addText(`Risk Score: ${d.overallRiskScore}/10 · Quality Score: ${d.overallQualityScore}/10`, margin, y + 5, 13, [0, 212, 170], true)
          if (d.riskSummary) { checkPage(); y = addText(d.riskSummary, margin + 10, y + 6, 9, [160, 190, 210]) }
          if (d.riskFactors?.length) {
            checkPage()
            y = addText('Risk Factors:', margin, y + 12, 10, [0, 212, 170], true)
            d.riskFactors.forEach(r => {
              checkPage(28)
              y = addText(`${r.risk} [Severity: ${r.severity} · Likelihood: ${r.likelihood}]`, margin + 5, y + 6, 9, [200, 220, 235], true)
              if (r.detail) y = addText(r.detail, margin + 10, y + 3, 8, [130, 165, 195])
            })
          }

        } else if (activeTab === 'news') {
          y = addText(`Sentiment: ${d.sentimentLabel} (${d.sentimentScore}/100)`, margin, y + 5, 13, [0, 212, 170], true)
          if (d.sentimentRationale) { checkPage(); y = addText(d.sentimentRationale, margin + 10, y + 6, 9, [160, 190, 210]) }
          if (d.keyThemes?.length) {
            checkPage()
            y = addText('Key Themes:', margin, y + 12, 10, [0, 212, 170], true)
            d.keyThemes.forEach(t => { checkPage(20); y = addText(`${t.sentiment} · ${t.theme}: ${t.detail}`, margin + 10, y + 5, 8, [130, 165, 195]) })
          }
          if (d.tradingNote) {
            checkPage()
            y = addText('Trading Note:', margin, y + 12, 10, [0, 212, 170], true)
            y = addText(d.tradingNote, margin + 10, y + 4, 9, [160, 190, 210])
          }
        }
      } else {
        y = addText('No analysis data available. Please run the analysis first.', margin, y + 10, 10, [245, 158, 11])
      }

      // ─── Disclaimer ────────────────────────────────────────────────────
      checkPage(50)
      y += 20
      y = hr(y)
      y = addText('⚠ Disclaimer: For educational and informational purposes only. Does not constitute financial advice. Always conduct your own research before making investment decisions.', margin, y + 8, 8, [80, 110, 130])

      // ─── Footer on all pages ───────────────────────────────────────────
      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        const H = doc.internal.pageSize.getHeight()
        doc.setFillColor(7, 9, 13)
        doc.rect(0, H - 28, W, 28, 'F')
        doc.setFontSize(7)
        doc.setTextColor(60, 90, 110)
        doc.text(`AlphaLens AI · alphalens-ai-beta.vercel.app · Not financial advice`, margin, H - 12)
        doc.text(`Page ${i} of ${pageCount}`, W - margin - 40, H - 12)
      }

      // Sanitize ticker for filename to prevent path traversal
const validatedTicker = stockData?.ticker
  ? strictValidateTicker(String(stockData.ticker))
  : { valid: false }
const safeTicker = validatedTicker.valid ? validatedTicker.ticker : 'Report'

// Generate filename with path-safe components only
const dateStr = new Date().toISOString().slice(0, 10)
const safeTab = String(activeTab).replace(/[^a-zA-Z0-9]/g, '')
const filename = `AlphaLens_${safeTicker}_${safeTab}_${dateStr}.pdf`
      doc.save(filename)

    } catch (err) {
      console.error('PDF export failed:', err)
      setError('PDF export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <button
        className="btn btn-outline no-print"
        onClick={handleExport}
        disabled={exporting}
        style={{ fontSize: '0.78rem' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        {exporting ? 'Exporting…' : 'Export PDF'}
      </button>
      {error && <span style={{ fontSize: '0.72rem', color: '#ef4444', fontFamily: 'var(--font-dm-mono)' }}>{error}</span>}
    </div>
  )
}
