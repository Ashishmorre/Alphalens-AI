# Notepad
<!-- Auto-managed by OMC. Manual edits preserved in MANUAL section. -->

## Priority Context
<!-- ALWAYS loaded. Keep under 500 chars. Critical discoveries only. -->

## Working Memory
<!-- Session notes. Auto-pruned after 7 days. -->

## MANUAL
<!-- User content. Never auto-pruned. -->
### 2026-04-12 11:16
# AlphaLens AI Security Audit Report
## Date: 2026-04-12
### Auditor: Claude Opus 4.6

## Executive Summary
5 critical architectural vulnerabilities identified across data pipelines, mathematical operations, serverless infrastructure, AI engine, and UI performance.

## Findings by Pillar

### [CRITICAL] Pillar 1: Data Pipeline Resilience & Race Conditions
**File**: `lib/dedupe.js:7`, `app/api/stock/route.js`  
**Issue**: The `inFlight` Map in dedupe.js can grow unbounded if promises reject without calling `.finally()` cleanup.  
**Impact**: Memory leak causing serverless function OOM crashes.  
**Fix**: Add max size limit and TTL eviction.

### [CRITICAL] Pillar 2: Mathematical Edge Cases
**File**: `lib/financial-utils.js`  
**Issue**: Multiple division operations lack zero guards: `calculateRatiosFromXBRL`, `debtToEquity`, `currentRatio`.  
**Impact**: `Infinity` or `NaN` values crash JSON schema validation.  
**Fix**: Add defensive checks: `if (denominator === 0) return null`

### [HIGH] Pillar 3: Serverless Memory & Rate Limiting
**File**: `lib/rate-limit.js:7`  
**Issue**: In-memory `rateLimitMap` doesn't persist across serverless invocations on Vercel.  
**Impact**: Rate limiting ineffective across different function instances.  
**Fix**: Implement Redis/Upstash rate limiting (already have @upstash/ratelimit dependency).  

### [HIGH] Pillar 4: AI Engine Vulnerabilities  
**File**: `lib/json-parser.js:71`  
**Issue**: Truncated JSON from AI (exceeds maxTokens) throws unhandled error.  
**Impact**: 500 error exposed to users.  
**Status**: PARTIALLY FIXED - defensive parsing added in route.js.

### [MODERATE] Pillar 5: UI Render Bottlenecks
**File**: `contexts/DCFContext.js`  
**Issue**: `calculateSensitivity` runs on every state change, not just assumption changes.  
**Impact**: Unnecessary re-renders on unrelated state updates.

## Recommendations Priority
1. Fix mathematical zero-division guards [CRITICAL]
2. Implement Redis rate limiting [HIGH]  
3. Add dedupe cleanup interval [CRITICAL]
4. Memoize sensitivity calculations [MODERATE]


