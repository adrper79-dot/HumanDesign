# ⚠️ MASTER BACKLOG (Archived - See MASTER_BACKLOG_SYSTEM_V2.md)

> **MIGRATION NOTICE (2026-03-17):** This file has been superseded by **[MASTER_BACKLOG_SYSTEM_V2.md](MASTER_BACKLOG_SYSTEM_V2.md)**, which reorganizes all 51 items into a system-based structure (Backend, Frontend, Engine, Billing, Practitioners, Security, Ops, Testing, Docs).
>
> **What changed:**
> - ✅ All items from this file migrated to new system-based organization
> - ✅ Audit findings consolidated and linked to source
> - ✅ Quick reference table added (P0/P1/P2/P3 by system)
> - ✅ Deduplication complete
> - ✅ Latest 2026-03-17 findings integrated (register 500 error, public/auth mismatch)

---

## Who Should Use What Now

- **Current Sprint Work** → Start with **[BACKLOG.md](BACKLOG.md)** (simplified sprint view)
- **Complete Backlog** → Use **[MASTER_BACKLOG_SYSTEM_V2.md](MASTER_BACKLOG_SYSTEM_V2.md)** (full system-organized; all details)
- **Historical Context** → See `audits/` folder and archive links in MASTER_BACKLOG_SYSTEM_V2.md

---

## Old Content (Archived)

The historical content from this document (2026-03-14 Production Readiness Audit, Phase 2 audit findings, etc.) is preserved in [MASTER_BACKLOG_SYSTEM_V2.md](MASTER_BACKLOG_SYSTEM_V2.md) with system-based organization and complete audit links.

---
> **2026-07-19 PHASE 2 LOW + FULL-STACK AUDIT SPRINT:** 25 items resolved — all 11 Phase 2 Low fixes (P2-FE-009 through P2-FE-013, P2-SEC-019 through P2-SEC-022, P2-ENGINE-007), 7 Full-Stack Audit code/security fixes (AUDIT-SEC-004/005, AUDIT-CODE-001 through 004, AUDIT-DATA-001/002), and 7 documentation fixes (AUDIT-DOC-001 through 007). Response envelope fully standardized (`success:` → `ok:` in 7 handler files, 48 replacements). CAN-SPAM email unsubscribe implemented full-stack. `window.currentUser` now frozen.
