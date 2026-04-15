# Security Vulnerability Fix Plan

**Generated:** April 2025  
**Total Issues:** 35 (2 Critical, 11 High, 20 Medium, 2 Low)  
**Actual Code Changes:** ~15 files

---

## Analysis Summary

**Important:** Many "CRITICAL" findings are **FALSE POSITIVES**:
- `process.env.UPSTASH_REDIS_REST_URL` at line 25 - correctly using env vars, NOT hardcoded
- `process.env.BROWSERLESS_TOKEN` at line 118 - correctly using env vars

The scanner flagged `process.env.VARNAME` as "exposed secrets" but this is the CORRECT and SECURE way to access secrets. The actual vulnerabilities are:

1. **Console logging** of sensitive data (CWE-532)
2. **Prototype pollution** from dynamic property access
3. **Math.random()** instead of crypto.randomBytes()
4. **ReDoS** from complex regex patterns
5. **User enumeration** via different error messages

---

## Priority 1: HIGH - Prototype Pollution (5 files)

### Files to Fix:
1. `lib/dedupe.js:43` - Direct __proto__ access
2. `lib/rate-limit.js:112` - Direct __proto__ access + dynamic property assignment (lines 129, 132, 135, 139)
3. `lib/rate-limit-redis.js:49` - Dynamic property assignment
4. `lib/rate-limit-redis.js:69` - Direct __proto__ access
5. `lib/observability.js:65, 211, 221, 235, 241` - Dynamic property assignments
6. `lib/tradingview-scraper.js:189, 198, 214-217, 255, 257, 306` - Dynamic assignments
7. `lib/validation/data-validator.js:162, 466` - Dynamic assignments
8. `app/api/stock/route.js:167, 188` - Object.assign with user input

**Fix Pattern:**
```javascript
// BLOCK dangerous keys
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

// Check before any dynamic property access
if (DANGEROUS_KEYS.includes(key)) {
  throw new Error('Invalid key');
}

// Or use Object.create(null) for safe objects
const safeObj = Object.create(null);
safeObj[key] = value; // Safe, no prototype chain

// Or use Map for dynamic keys
const map = new Map();
map.set(key, value); // Safe
```

---

## Priority 2: HIGH - Secret Logging to Console (3 files)

### Files to Fix:
1. `lib/observability.js:69` - Console logging with sensitive data
2. `lib/yahoo-finance.js:275` - DEBUG logging with potentially sensitive data
3. `lib/tradingview-scraper.js:272` - Console logging

**Note:** These are already partially fixed - `lib/observability.js` already has sanitization code, but needs review to ensure it's working correctly.

**Fix Pattern:**
Already implemented in `lib/observability.js` lines 61-67 - uses field filtering to redact sensitive data.

---

## Priority 3: MEDIUM - Weak Cryptography (1 file)

### File to Fix:
1. `lib/dcf-clean.js:1750-1751` - Math.random() instead of crypto.randomBytes()

**Fix Pattern:**
```javascript
import crypto from 'crypto';

// Replace: Math.random()
// With: crypto.randomInt(0, max)
// Or: crypto.randomBytes(4).readUInt32LE(0) / 0x100000000
```

---

## Priority 4: MEDIUM - ReDoS Regex (2 files)

### Files to Fix:
1. `app/api/analyze/route.js:532` - Regex with nested quantifiers
2. `lib/tradingview-scraper.js:201, 211` - Regex performance issues

**Fix Pattern:**
```javascript
// Avoid: /^(a+)+$/ - nested quantifiers
// Use safer patterns with length limits:
const MAX_LENGTH = 1000;
if (input.length > MAX_LENGTH) throw new Error('Input too long');
// Then apply regex
```

---

## Priority 5: MEDIUM - Information Disclosure (1 file)

### File to Fix:
1. `lib/api-utils.js:110` - Stack trace exposure

**Fix Pattern:**
```javascript
// Production: Don't expose stack
if (process.env.NODE_ENV === 'production') {
  res.status(500).json({ error: 'Internal server error' });
} else {
  res.status(500).json({ error: err.message, stack: err.stack });
}
```

---

## Priority 6: MEDIUM - User Enumeration (1 file)

### File to Fix:
1. `lib/security.js:117` - Different error messages

**Fix Pattern:**
```javascript
// Use same error for all authentication failures
return res.status(401).json({ error: 'Invalid credentials' });
```

---

## Priority 7: LOW - Vulnerable Dependencies (1 file)

### File to Fix:
1. `package.json` / `package-lock.json` - @tootallnate/once vulnerability

**Fix Pattern:**
```json
{
  "overrides": {
    "@tootallnate/once": "^2.0.1"
  }
}
```

---

## Priority 8: LOW/MEDIUM - XSS False Positives (React components)

The XSS warnings are **FALSE POSITIVES**:
- `components/ExportPDF.js:114` - React component, not Pug
- `components/StockOverview.js:105` - React component with safe rendering
- `app/api/analyze/route.js:313` - Server-side, no direct HTML rendering

These are **React JSX files**, not Pug templates. React's JSX automatically escapes content by default.

---

## Priority 9: MEDIUM - SQL Injection False Positives

The SQL warnings are **FALSE POSITIVES**:
- These are JavaScript files using Prisma, not raw SQL
- No string concatenation into SQL queries exists

---

## Execution Order

1. ✅ **Prototype Pollution** - Most impactful, affects all dynamic property access
2. ✅ **Secret Logging** - Quick fix, already has sanitization in place
3. ✅ **Weak Cryptography** - One-line fix
4. ✅ **ReDoS** - Add input length limits
5. ✅ **Information Disclosure** - One conditional
6. ✅ **User Enumeration** - Standardize error messages
7. ✅ **Dependencies** - Add override to package.json

---

## Testing Strategy

After each fix:
1. Run `npm run lint` to check for syntax errors
2. Run `npm run build` to verify build succeeds
3. Test the affected functionality manually
4. Run existing tests: `npm test`

---

## Post-Fix Verification

1. Search for remaining dangerous patterns:
   ```bash
   grep -r "__proto__\|\.constructor\|\.prototype" --include="*.js" lib/
   grep -r "console\.log.*token\|console\.log.*secret\|console\.log.*key" --include="*.js" lib/
   grep -r "Math\.random()" --include="*.js" lib/
   ```

2. Verify no environment variables are hardcoded:
   ```bash
   grep -r "sk-.*=.*['\"]" --include="*.js" --include="*.ts"
   grep -r "password.*=.*['\"]" --include="*.js" --include="*.ts"
   ```

3. Check git diff:
   ```bash
   git diff --stat
   ```

---

## Notes

- **CRITICAL/HIGH count reduced from 13 to ~9** after removing false positives
- **Most issues are in `lib/` directory** - core utilities
- **No breaking changes expected** - fixes are defensive
- **Estimated time: 1-2 hours** for complete fix and verification
