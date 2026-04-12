/**
 * Sector Validation and Peer Mapping
 * Prevents AI hallucination of peers across different sectors
 */

// Sector mapping for major stock exchanges
const SECTOR_MAP = {
  // Utilities
  'TATAPOWER.NS': { sector: 'Utilities', name: 'Tata Power' },
  'POWERGRID.NS': { sector: 'Utilities', name: 'Power Grid Corp' },
  'NTPC.NS': { sector: 'Utilities', name: 'NTPC Ltd' },
  'ADANIGREEN.NS': { sector: 'Utilities', name: 'Adani Green Energy' },
  'JSWENERGY.NS': { sector: 'Utilities', name: 'JSW Energy' },
  'TORRENTPOWER.NS': { sector: 'Utilities', name: 'Torrent Power' },
  'NHPC.NS': { sector: 'Utilities', name: 'NHPC Ltd' },
  'CESC.NS': { sector: 'Utilities', name: 'CESC Ltd' },
  'NEVEX.NS': { sector: 'Utilities', name: 'Nava Bharat Ventures' },
  'KPIGREEN.NS': { sector: 'Utilities', name: 'KPI Green Energy' },

  // Healthcare
  'FORTIS.NS': { sector: 'Healthcare', name: 'Fortis Healthcare' },
  'MAXHEALTH.NS': { sector: 'Healthcare', name: 'Max Healthcare' },
  'APOLLOHOSP.NS': { sector: 'Healthcare', name: 'Apollo Hospitals' },
  'MEDANTA.NS': { sector: 'Healthcare', name: 'Global Health' },
  'NH.NS': { sector: 'Healthcare', name: 'Narayana Hrudayalaya' },
  'ASTERDM.NS': { sector: 'Healthcare', name: 'Aster DM Healthcare' },
  'LALPATHLAB.NS': { sector: 'Healthcare', name: 'Lal Pathlabs' },
  'METROPOLIS.NS': { sector: 'Healthcare', name: 'Metropolis Healthcare' },
  'THYROCARE.NS': { sector: 'Healthcare', name: 'Thyrocare Technologies' },

  // Banking
  'HDFCBANK.NS': { sector: 'Banking', name: 'HDFC Bank' },
  'ICICIBANK.NS': { sector: 'Banking', name: 'ICICI Bank' },
  'SBIN.NS': { sector: 'Banking', name: 'State Bank of India' },
  'AXISBANK.NS': { sector: 'Banking', name: 'Axis Bank' },
  'KOTAKBANK.NS': { sector: 'Banking', name: 'Kotak Mahindra Bank' },
  'INDUSINDBK.NS': { sector: 'Banking', name: 'IndusInd Bank' },
  'BANDHANBNK.NS': { sector: 'Banking', name: 'Bandhan Bank' },
  'PNB.NS': { sector: 'Banking', name: 'Punjab National Bank' },
  'UNIONBANK.NS': { sector: 'Banking', name: 'Union Bank' },

  // Technology
  'TCS.NS': { sector: 'Technology', name: 'Tata Consultancy Services' },
  'INFY.NS': { sector: 'Technology', name: 'Infosys' },
  'WIPRO.NS': { sector: 'Technology', name: 'Wipro' },
  'HCLTECH.NS': { sector: 'Technology', name: 'HCL Technologies' },
  'TECHM.NS': { sector: 'Technology', name: 'Tech Mahindra' },
  'MPHASIS.NS': { sector: 'Technology', name: 'Mphasis' },
  'PERSISTENT.NS': { sector: 'Technology', name: 'Persistent Systems' },
  'LTIM.NS': { sector: 'Technology', name: 'L&T Infotech' },

  // Energy/Oil
  'RELIANCE.NS': { sector: 'Energy', name: 'Reliance Industries' },
  'ONGC.NS': { sector: 'Energy', name: 'Oil & Natural Gas Corp' },
  'IOC.NS': { sector: 'Energy', name: 'Indian Oil Corp' },
  'BPCL.NS': { sector: 'Energy', name: 'Bharat Petroleum' },
  'HPCL.NS': { sector: 'Energy', name: 'Hindustan Petroleum' },
  'GAIL.NS': { sector: 'Energy', name: 'GAIL India' },
}

/**
 * Get sector information for a ticker
 * @param {string} ticker - Stock ticker symbol
 * @returns {Object|null} Sector info or null if unknown
 */
export function getSectorInfo(ticker) {
  if (!ticker) return null
  const upperTicker = ticker.toUpperCase()
  return SECTOR_MAP[upperTicker] || null
}

/**
 * Validate peers belong to same sector
 * @param {string} ticker - Primary ticker
 * @param {Array} peers - Array of peer ticker strings or objects
 * @returns {Object} Validation result with filtered valid peers
 */
export function validatePeers(ticker, peers) {
  if (!ticker || !peers || !Array.isArray(peers)) {
    return {
      isValid: false,
      primarySector: null,
      validPeers: [],
      rejectedPeers: [],
      errors: ['Invalid input: ticker and peers array required']
    }
  }

  const primaryInfo = getSectorInfo(ticker)
  if (!primaryInfo) {
    return {
      isValid: false,
      primarySector: null,
      validPeers: [],
      rejectedPeers: peers,
      errors: [`Unknown ticker: ${ticker}, cannot determine sector`]
    }
  }

  const primarySector = primaryInfo.sector
  const validPeers = []
  const rejectedPeers = []
  const errors = []

  for (const peer of peers) {
    // Handle string or object input
    const peerTicker = typeof peer === 'string' ? peer : peer?.ticker
    if (!peerTicker) {
      rejectedPeers.push(peer)
      errors.push('Peer missing ticker symbol')
      continue
    }

    const peerInfo = getSectorInfo(peerTicker)
    if (!peerInfo) {
      // Peer not in our database - reject to prevent hallucinations
      rejectedPeers.push({
        ticker: peerTicker,
        original: peer,
        reason: 'Unknown ticker - cannot verify sector'
      })
      errors.push(`Peer ${peerTicker}: unknown ticker, rejecting`)
      continue
    }

    if (peerInfo.sector !== primarySector) {
      // Sector mismatch - reject
      rejectedPeers.push({
        ticker: peerTicker,
        original: peer,
        reason: `Sector mismatch: ${peerInfo.sector} vs ${primarySector}`,
        peerSector: peerInfo.sector,
        primarySector
      })
      errors.push(`Peer ${peerTicker}: sector ${peerInfo.sector} does not match ${primarySector}`)
      continue
    }

    // Valid peer
    validPeers.push({
      ticker: peerTicker,
      original: peer,
      sector: peerInfo.sector,
      name: peerInfo.name
    })
  }

  return {
    isValid: validPeers.length > 0,
    primarySector,
    validPeers,
    rejectedPeers,
    errors
  }
}

/**
 * Get suggested peers for a ticker from our database
 * @param {string} ticker - Stock ticker
 * @param {number} limit - Maximum peers to return
 * @returns {Array} Array of validated peers
 */
export function getSuggestedPeers(ticker, limit = 5) {
  const primaryInfo = getSectorInfo(ticker)
  if (!primaryInfo) return []

  const sameSectorPeers = Object.entries(SECTOR_MAP)
    .filter(([t, info]) => info.sector === primaryInfo.sector && t !== ticker.toUpperCase())
    .map(([t, info]) => ({
      ticker: t,
      name: info.name,
      sector: info.sector
    }))
    .slice(0, limit)

  return sameSectorPeers
}

/**
 * Check if valuation is valid for public consumption
 * Used by UI to show error states
 * @param {Object} data - Normalized AI data
 * @returns {Object} Validation status
 */
export function validateAnalysisQuality(data) {
  const MIN_DRIVERS = 2

  const errors = []

  if (!data) {
    errors.push('No analysis data')
    return { isValid: false, errors }
  }

  // Confidence check
  if (data.confidence === undefined || data.confidence === null) {
    errors.push('Confidence score missing')
  } else if (data.confidence < 20) {
    errors.push(`Confidence ${data.confidence}% below minimum threshold 20%`)
  }

  // Drivers check
  if (!data.keyDrivers || data.keyDrivers.length === 0) {
    errors.push('No investment drivers identified')
  } else {
    const validDrivers = data.keyDrivers.filter(
      d => d && d.driver && d.driver !== 'Unknown' && d.driver !== ''
    )
    if (validDrivers.length < MIN_DRIVERS) {
      errors.push(`Only ${validDrivers.length} valid drivers (min: ${MIN_DRIVERS})`)
    }
  }

  // Price target check
  if (!data.targetPrice || data.targetPrice === null) {
    errors.push('Target price missing')
  }

  if (!data.currentPrice || data.currentPrice === null) {
    errors.push('Current price missing')
  }

  // Peer validation check
  if (data.comparisonPeers && data.comparisonPeers.length > 0) {
    // Note: Full peer validation requires ticker, done at component level
    const unknownPeers = data.comparisonPeers.filter(p => {
      const ticker = typeof p === 'string' ? p : p?.ticker
      return !getSectorInfo(ticker)
    })
    if (unknownPeers.length > 0) {
      errors.push(`${unknownPeers.length} peers are unknown`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    confidence: data.confidence || 0,
    driverCount: data.keyDrivers?.length || 0
  }
}

export default {
  getSectorInfo,
  validatePeers,
  getSuggestedPeers,
  validateAnalysisQuality,
  MIN_CONFIDENCE_THRESHOLD: 20
}
