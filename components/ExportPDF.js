'use client'
import { useState } from 'react'

export default function ExportPDF({ stockData, analysisData, activeTab }) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })

      const W = doc.internal.pageSize.getWidth()
      const margin = 40
      let y = margin

      // ─── Helpers ───────────────────────────────────────────────────────
      const line = (text, x, yPos, size = 10, color = [180, 200, 220], bold = false, maxW = W - margin * 2) => {
        doc.setFontSize(size)
        doc.setTextColor(...color)
        if (bold) doc.setFont('helvetica', 'bold')
        else doc.setFont('helvetica', 'normal')
        const lines = doc.splitTextToSize(text || '', maxW)
        doc.text(lines, x, yPos)
        return yPos + lines.length * (size * 1.4)
      }

      const checkPage = (needed = 60) => {
        if (y + needed > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage()
          y = margin
        }
      }

      const hr = (yPos) => {
        doc.setDrawColor(0, 70, 55)
        doc.setLineWidth(0.5)
        doc.line(margin, yPos, W - margin, yPos)
        return yPos + 10
      }

      // ─── Background ────────────────────────────────────────────────────
      doc.setFillColor(7, 9, 13)
      doc.rect(0, 0, W, doc.internal.pageSize.getHeight(), 'F')

      // ─── Header bar ───────────────────────────────────────────────────
      doc.setFillColor(0, 212, 170)
      doc.rect(0, 0, W, 4, 'F')

      // ─── Title block ──────────────────────────────────────────────────
      y = 30
      y = line('AlphaLens AI', margin, y, 22, [0, 212, 170], true)
      y = line('Institutional Equity Research Report', margin, y + 2, 10, [100, 140, 170])
      y += 10

      if (stockData) {
        const change = stockData.changePercent >= 0
        const changeStr = `${stockData.changePercent >= 0 ? '+' : ''}${stockData.changePercent?.toFixed(2)}%`

        // Company block
        doc.setFillColor(15, 21, 32)
        doc.roundedRect(margin, y, W - margin * 2, 80, 4, 4, 'F')
        y += 14

        y = line(`${stockData.ticker} — ${stockData.name}`, margin + 12, y, 16, [232, 242, 252], true)
        y = line(`${stockData.sector || ''} · ${stockData.industry || ''}`, margin + 12, y + 2, 9, [100, 140, 170])

        const priceColor = change ? [34, 197, 94] : [239, 68, 68]
        y = line(`$${stockData.price?.toFixed(2)}  ${changeStr}`, margin + 12, y + 8, 18, priceColor, true)
        y += 16

        y = hr(y)

        // Key stats grid
        const stats = [
          ['Market Cap', formatNum(stockData.marketCap)],
          ['P/E (TTM)', stockData.pe?.toFixed(1) || '—'],
          ['EV/EBITDA', stockData.evToEbitda?.toFixed(1) || '—'],
          ['ROE', stockData.roe ? (stockData.roe * 100).toFixed(1) + '%' : '—'],
          ['Net Margin', stockData.profitMargin ? (stockData.profitMargin * 100).toFixed(1) + '%' : '—'],
          ['Revenue', formatNum(stockData.revenue)],
          ['FCF', formatNum(stockData.freeCashFlow)],
          ['Beta', stockData.beta?.toFixed(2) || '—'],
        ]

        const colW = (W - margin * 2) / 4
        stats.forEach(([label, val], i) => {
          checkPage(30)
          const col = i % 4
          const row = Math.floor(i / 4)
          if (col === 0 && i > 0) y += 30

          const x = margin + col * colW
          doc.setFontSize(7)
          doc.setTextColor(80, 110, 130)
          doc.text(label.toUpperCase(), x, y)
          doc.setFontSize(10)
          doc.setTextColor(200, 220, 240)
          doc.text(val, x, y + 13)
        })
        y += 35
      }

      y = hr(y)

      // ─── Analysis content ─────────────────────────────────────────────
      const tabLabels = { thesis: 'Investment Thesis', dcf: 'DCF Valuation', risk: 'Risk & Ratios', news: 'News Sentiment' }
      checkPage()
      y = line(`AI Analysis: ${tabLabels[activeTab] || activeTab}`, margin, y + 5, 14, [0, 212, 170], true)
      y += 6
      y = hr(y)

      if (analysisData) {
        const d = analysisData

        if (activeTab === 'thesis') {
          checkPage()
          y = line(`Verdict: ${d.verdict}`, margin, y + 5, 13, d.verdict === 'BUY' ? [34, 197, 94] : d.verdict === 'SELL' ? [239, 68, 68] : [245, 158, 11], true)
          y = line(`Target Price: $${d.targetPrice?.toFixed(2)} | Upside: ${d.upsideDownside?.toFixed(1)}% | Confidence: ${d.confidence}%`, margin, y + 4, 9, [140, 180, 200])
          if (d.thesisSummary) {
            checkPage()
            y = line('Summary:', margin, y + 10, 10, [0, 212, 170], true)
            y = line(d.thesisSummary, margin, y + 3, 9, [150, 180, 200])
          }
          if (d.bullCase) {
            checkPage()
            y = line('Bull Case:', margin, y + 10, 10, [34, 197, 94], true)
            y = line(d.bullCase.title, margin, y + 3, 9, [140, 180, 200])
            d.bullCase.points?.forEach(p => { checkPage(20); y = line(`• ${p}`, margin + 10, y + 4, 8, [120, 160, 190]) })
          }
          if (d.bearCase) {
            checkPage()
            y = line('Bear Case:', margin, y + 10, 10, [239, 68, 68], true)
            y = line(d.bearCase.title, margin, y + 3, 9, [140, 180, 200])
            d.bearCase.points?.forEach(p => { checkPage(20); y = line(`• ${p}`, margin + 10, y + 4, 8, [120, 160, 190]) })
          }
        } else if (activeTab === 'dcf') {
          y = line(`Intrinsic Value: $${d.intrinsicValuePerShare?.toFixed(2)} (${d.upside >= 0 ? '+' : ''}${d.upside?.toFixed(1)}% vs current)`, margin, y + 5, 13, [0, 212, 170], true)
          y = line(`WACC: ${d.assumptions?.wacc?.toFixed(1)}% | TGR: ${d.assumptions?.terminalGrowthRate?.toFixed(1)}% | Rating: ${d.dcfRating}`, margin, y + 4, 9, [140, 180, 200])
          if (d.analystNote) {
            checkPage()
            y = line('Analyst Note:', margin, y + 10, 10, [0, 212, 170], true)
            y = line(d.analystNote, margin, y + 3, 9, [150, 180, 200])
          }
          if (d.projections?.length) {
            checkPage(80)
            y = line('5-Year Projections:', margin, y + 12, 10, [0, 212, 170], true)
            d.projections.forEach(p => {
              checkPage(20)
              y = line(`Year ${p.year}: Revenue ${formatNum(p.revenue)} | EBITDA ${formatNum(p.ebitda)} | FCF ${formatNum(p.fcf)}`, margin + 10, y + 5, 8, [130, 165, 195])
            })
          }
        } else if (activeTab === 'risk') {
          y = line(`Risk Score: ${d.overallRiskScore?.toFixed(1)}/10 | Quality Score: ${d.overallQualityScore?.toFixed(1)}/10`, margin, y + 5, 13, [0, 212, 170], true)
          if (d.riskSummary) { checkPage(); y = line(d.riskSummary, margin, y + 6, 9, [150, 180, 200]) }
          if (d.riskFactors?.length) {
            checkPage()
            y = line('Key Risk Factors:', margin, y + 10, 10, [0, 212, 170], true)
            d.riskFactors.forEach(r => {
              checkPage(25)
              y = line(`${r.risk} [Severity: ${r.severity} | Likelihood: ${r.likelihood}]`, margin + 5, y + 6, 9, [200, 220, 235], true)
              if (r.detail) y = line(r.detail, margin + 10, y + 3, 8, [130, 165, 195])
            })
          }
        } else if (activeTab === 'news') {
          y = line(`Sentiment: ${d.sentimentLabel} (${d.sentimentScore}/100)`, margin, y + 5, 13, [0, 212, 170], true)
          if (d.sentimentRationale) { checkPage(); y = line(d.sentimentRationale, margin, y + 6, 9, [150, 180, 200]) }
          if (d.tradingNote) {
            checkPage()
            y = line('Trading Note:', margin, y + 10, 10, [0, 212, 170], true)
            y = line(d.tradingNote, margin, y + 3, 9, [150, 180, 200])
          }
        }
      }

      // ─── Footer ───────────────────────────────────────────────────────
      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFillColor(7, 9, 13)
        const H = doc.internal.pageSize.getHeight()
        doc.rect(0, H - 30, W, 30, 'F')
        doc.setFontSize(7)
        doc.setTextColor(60, 90, 110)
        doc.text(`AlphaLens AI · Generated ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })} · For informational purposes only, not investment advice`, margin, H - 14)
        doc.text(`Page ${i} of ${pageCount}`, W - margin - 40, H - 14)
      }

      const filename = `AlphaLens_${stockData?.ticker || 'Report'}_${activeTab}_${new Date().toISOString().slice(0,10)}.pdf`
      doc.save(filename)
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <button className="btn btn-outline no-print" onClick={handleExport} disabled={exporting} style={{ fontSize: '0.78rem' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      {exporting ? 'Exporting…' : 'Export PDF'}
    </button>
  )
}

function formatNum(n) {
  if (n == null || isNaN(n)) return '—'
  if (Math.abs(n) >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'
  if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  return '$' + n.toFixed(2)
}
