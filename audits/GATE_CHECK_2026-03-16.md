# GATE CHECK — FINAL LAUNCH CERTIFICATION

Product: Prime Self Engine  
App domain: selfprime.net  
API: https://prime-self-api.adrper79.workers.dev  
Date: 2026-03-16

## Remediation Update — 2026-03-16 12:35 UTC

This report captured a real stop-ship condition at the time it was written. The specific production blockers documented below have since been remediated and revalidated:

- `selfprime.net/api/health` now returns the Worker JSON health payload over the public domain.
- Frontend production surfaces were switched to same-origin `/api` via a Cloudflare Pages proxy.
- A live duplicate-checkout `1101` crash in billing was fixed by removing cross-request Neon pool reuse in `workers/src/db/queries.js` and redeploying the Worker.
- Targeted live money-path smoke now passes via `workers/verify-money-path.js`: individual checkout creation, duplicate session reuse, practitioner checkout creation, agency contact gate, and billing portal access.

This addendum does not replace a full fresh gate certification. It records that the original Phase 0 routing blocker and the follow-on duplicate-checkout runtime failure are no longer reproducing in production.

## GATE CHECK OFFICER VERDICT: DO NOT LAUNCH

Phase 0 contains a hard failure. Per gate rules, certification stops there.

Primary blocker: selfprime.net does not route `/api/*` traffic to the production Worker. A live request to `https://selfprime.net/api/health` returned the frontend-branded 404 page instead of the Worker health JSON. That means the production custom domain is not wired as the Worker/API origin, which fails the environment lock.

Additional corroborating failure: the current production login e2e also failed with `Connection error: Failed to fetch`, leaving the UI in `Not signed in` state.

---

## Stop Condition

Gate rule triggered:

```text
IF Phase 0 has ANY fail -> DO NOT LAUNCH
```

Result: triggered by Phase 0.5.

---

## Evidence Summary

### Live runtime evidence

1. `curl -i https://selfprime.net/api/health`
   - Status: `404`
   - Response title: `Page Not Found — Prime Self`
   - Response body was the frontend 404 HTML, not Worker JSON.

2. `curl -s https://prime-self-api.adrper79.workers.dev/api/health?full=1`
   - Returned healthy Worker JSON with:
     - `status: "ok"`
     - `db.ok: true`
     - `kv.ok: true`
     - `stripe.ok: true`
     - all critical secrets present.

3. CORS preflight checks against the live Worker:
   - `Origin: https://selfprime.net` -> allowed
   - `Origin: https://evil.example.com` -> not allowed
   - `Origin: https://primeself.app` -> not allowed

4. Production login e2e result:
   - Test summary: `0 passed, 1 failed`
   - Failure: `tests/e2e/login.spec.ts`
   - UI snapshot showed `Connection error: Failed to fetch`
   - Auth status remained `Not signed in`

### Source evidence

- Production environment is configured in `workers/wrangler.toml` with `ENVIRONMENT = "production"`.
- KV namespaces are bound in `workers/wrangler.toml`.
- Production CORS explicitly allows `https://selfprime.net` in `workers/src/middleware/cors.js`.
- Frontend API calls target the Worker hostname, not `/api` on selfprime.net, in `frontend/js/app.js` and CSP/connect hints in `frontend/index.html`.

---

## Phase 0 — Environment Lock

| Check | Result | Evidence |
|---|---|---|
| 0.1 Production Worker environment exists | PASS | `workers/wrangler.toml` sets `ENVIRONMENT = "production"` |
| 0.2 Required secrets bound | PASS | `wrangler secret list` showed `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `GROK_API_KEY`, `GROQ_API_KEY` |
| 0.3 Production DB bound | PASS | Worker health returned `db.ok: true`; architecture uses Neon via `NEON_CONNECTION_STRING`, not D1 |
| 0.4 KV namespace bound | PASS | `CACHE` and `RATE_LIMIT_KV` present in `workers/wrangler.toml` |
| 0.5 Custom domain resolves to the Worker | FAIL | `https://selfprime.net/api/health` returned frontend 404 HTML; Worker health only exists on `prime-self-api.adrper79.workers.dev` |
| 0.6 SSL / HTTPS enforced | PASS | `https://selfprime.net` responded over HTTPS with HSTS |
| 0.7 CORS limited to production origin | PASS | Live preflight allowed `selfprime.net`, denied `evil.example.com` |

### Phase 0 Verdict

FAIL.

Launch must stop here.

---

## Pre-Stop Observation

These checks were observed before finalizing the stop, but they do not change the root stop condition.

### Login regression

- Current e2e production login failed in `tests/e2e/login.spec.ts`
- Failure artifact captured:
  - expected auth text containing `adrper79`
  - received `Not signed in`
  - alert text: `Connection error: Failed to fetch`

This is consistent with a production environment/routing problem and is independently sufficient to create launch risk in Phase 2.

### Studio / Agency sale gate

Known issue `BL-MV-N1` appears resolved in code.

- `workers/src/handlers/billing.js` rejects `agency` checkout with `contactRequired: true`
- The same guard exists in both checkout paths

So the current binary verdict is not caused by selling an unfinished Agency/Studio tier. It is caused by environment wiring.

---

## Phase Matrix

| Category | Total Checks | Passed | Failed | Blocked |
|----------|-------------|--------|--------|---------|
| Phase 0: Environment | 7 | 6 | 1 | 0 |
| Phase 1: Money Path | ~30 | 0 | 0 | ~30 |
| Phase 2: First Impression | ~35 | 0 | 1 | ~34 |
| Phase 3: Product | ~20 | 0 | 0 | ~20 |
| Phase 4: Practitioner Journey | ~40 | 0 | 0 | ~40 |
| Phase 5: Security | ~20 | 0 | 0 | ~20 |
| Phase 6: Week Simulation | ~15 | 0 | 0 | ~15 |
| Phase 7: Performance | ~15 | 0 | 0 | ~15 |
| Phase 8: Cosmetic | ~20 | 0 | 0 | ~20 |
| TOTAL | ~202 | 6 | 2 | ~194 |

Notes:

- Phase 2 includes the observed login failure as a pre-stop finding.
- Remaining phases were not executed because the gate instructions require immediate stop on any Phase 0 fail.

---

## Sign-Off

```text
GATE CHECK OFFICER VERDICT: DO NOT LAUNCH
DATE: 2026-03-16
TOTAL CHECKS EXECUTED: 8 / ~200
PASS RATE (executed): 75%
P0 BLOCKERS:
- Phase 0.5: selfprime.net does not route /api/* to the production Worker

P1 ISSUES:
- Production login e2e failed with "Connection error: Failed to fetch"

CONFIDENCE LEVEL: HIGH
```

Notes:

- The production Worker itself appears healthy on the workers.dev hostname.
- The launch problem is environment topology, not just app logic.
- Until the public production domain and the Worker/API routing are aligned, a practitioner can hit inconsistent behavior depending on which hostname is in play.

---

## Required Fix Before Re-Certification

1. Wire the public production API path or API subdomain correctly.
   - Either make `selfprime.net/api/*` reach the Worker, or move the app to an explicit API domain and ensure the frontend, OAuth callbacks, billing returns, and operational docs consistently use it.

2. Re-run login in a real browser after the routing fix.
   - The current login failure needs to clear before launch.

3. Re-run the full money path after Phase 0 is green.
   - Checkout, webhook timing, billing portal, cancel/resubscribe, and double-charge stress were not certifiable because the gate stopped at environment lock.

---

## Appendix — Known Issue Cross-Reference

| Issue | Status | Evidence |
|---|---|---|
| BL-MV-N1 | RESOLVED | `agency` checkout is contact-gated in `workers/src/handlers/billing.js` |
| BL-C1 through BL-C6 | BLOCKED | These identifiers were not found in the current `audits/` search, so exact cross-reference could not be verified from repository evidence |
| P0/P1 from TIER_BILLING_WHITE_LABEL_AUDIT | PARTIAL | Billing tier naming drift appears addressed, but full live checkout verification was not executed because Phase 0 failed |
| P0/P1 from WORKERS_AUDIT_REPORT | PARTIAL | Historical findings are superseded by newer code and health results, but not all runtime journeys were re-executed |
| P0/P1 from PRODUCTION_BUG_REPORT | REGRESSION RISK | A fresh login e2e still fails with `Connection error: Failed to fetch`, so production journey reliability is not certified |
