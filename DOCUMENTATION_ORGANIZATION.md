# Documentation Organization

**Last Updated:** 2026-03-09  
**Purpose:** Master reference for documentation structure, locations, and relationships

---

## 📚 Documentation Structure

```
Prime Self Project
├── Root Level (Essential Only)
│   ├── README.md                          → Project overview, demo
│   ├── BACKLOG.md                         → Product backlog & sprints
│   └── DOCUMENTATION_ORGANIZATION.md      → This file
│
├── /docs                                  → Core Documentation Hub
│   ├── GETTING_STARTED.md                 → New user onboarding
│   ├── ARCHITECTURE.md                    → System design & tech stack
│   ├── DEPLOYMENT.md                      → Production deployment guide
│   ├── OPERATIONS.md                      → Monitoring & troubleshooting
│   ├── API_REFERENCE.md                   → Complete API documentation
│   ├── DESIGN_SYSTEM.md                   → UI components & patterns
│   ├── GLOSSARY.md                        → Terminology definitions
│   │
│   ├── /advanced                          → Advanced Reference Topics
│   │   ├── KNOWLEDGE_BASE.md              → Gene Keys corpus
│   │   ├── SYNTHESIS_ENGINE.md            → AI prompt engineering
│   │   └── DATABASE_SCHEMA.md             → Complete schema reference
│   │
│   └── openapi.json                       → OpenAPI 3.0 spec
│
├── /guides                                → Implementation How-To Guides
│   ├── SETUP_DEVELOPMENT.md               → Dev environment (5 min)
│   ├── BACKGROUND_VIDEO.md                → Cosmic background video setup
│   ├── STRIPE_INTEGRATION.md              → Payment system setup (30 min)
│   ├── PWA_CONFIGURATION.md               → Progressive Web App setup
│   ├── ENVIRONMENT_VARIABLES.md           → Secrets & config
│   │
│   └── /advanced                          → Advanced Implementation Guides
│       ├── CUSTOM_THEMES.md               → Theme customization
│       ├── API_INTEGRATION.md             → Building with the API
│       └── WHITE_LABEL.md                 → White-label deployment
│
├── /audits                                → Audit Reports & Analysis
│   ├── UX_AUDIT_2026-03-09.md            → User experience findings
│   ├── CODE_QUALITY_2026-03-08.md         → Code review results
│   ├── FRONTEND_AUDIT_2026-03-04.md       → Frontend code analysis
│   ├── DATABASE_AUDIT_2026-03-04.md       → Schema & query audit
│   ├── SECURITY_AUDIT_2026-03-09.md       → Security findings
│   │
│   └── /archive                           → Historical Audits
│       ├── AUDIT_2025-01.md               → January 2025 audit
│       └── DEFECT_AUDIT_WORKERS.md        → Worker code audit
│
└── /process                               → Development Process & Standards
    ├── BUILD_STANDARDS.md                 → Coding standards & patterns
    ├── TEST_STRATEGY.md                   → Testing approach & coverage
    ├── LESSONS_LEARNED.md                 → Historical incidents & learnings
    ├── CHANGE_LOG.md                      → Release history
    │
    ├── /dashboards                        → Status & Progress Reports
    │   ├── SPRINT_STATUS.md               → Current sprint progress
    │   ├── DEFECT_BACKLOG.md              → UI defect tracking
    │   └── FEATURE_BACKLOG.md             → Feature requests & prioritization
    │
    └── /archived                          → Old Process Docs
        └── BUILD_LOG_ARCHIVE.md           → Historical build logs
```

---

## 📍 Where to Find What

### For Different Audiences

**👤 New Users / Product Managers**
1. Start: [README.md](README.md)
2. Learn: [GLOSSARY.md](docs/GLOSSARY.md)
3. Explore: [BACKLOG.md](BACKLOG.md)

**👨‍💻 Developers**
1. Setup: [guides/SETUP_DEVELOPMENT.md](guides/SETUP_DEVELOPMENT.md)
2. Learn: [ARCHITECTURE.md](ARCHITECTURE.md)
3. Build: [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
4. Reference: [docs/API_REFERENCE.md](docs/API_REFERENCE.md)

**🔧 DevOps / Operations**
1. Deploy: [DEPLOY.md](DEPLOY.md)
2. Monitor: [docs/OPERATIONS.md](docs/OPERATIONS.md)
3. Configure: [guides/ENVIRONMENT_VARIABLES.md](guides/ENVIRONMENT_VARIABLES.md)

**🎨 Designers / UX**
1. Learn: [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
2. Review: [audits/UX_AUDIT_2026-03-09.md](audits/UX_AUDIT_2026-03-09.md)
3. Reference: [docs/GLOSSARY.md](docs/GLOSSARY.md)

**📊 Project Managers**
1. Status: [BACKLOG.md](BACKLOG.md)
2. Progress: [process/SPRINT_STATUS.md](process/SPRINT_STATUS.md)
3. Issues: [audits/](audits/)

---

## 🔗 Document Relationships

### Layer 1: Foundation
- README.md → GETTING_STARTED → ARCHITECTURE → DEPLOYMENT

### Layer 2: Development
- BUILD_STANDARDS → API_REFERENCE → DESIGN_SYSTEM
- SETUP_DEVELOPMENT → Guides → Advanced Topics

### Layer 3: Operations
- OPERATIONS → Guides → DEPLOYMENT

### Layer 4: Analysis
- Audits → LESSONS_LEARNED → BACKLOG

---

## 📝 Document Categories

### Core Documentation (Stable)
- [x] ARCHITECTURE.md - System design
- [x] API_REFERENCE.md - API docs
- [x] DESIGN_SYSTEM.md - UI guidelines
- [x] GLOSSARY.md - Terminology
- [x] DEPLOYMENT.md - Deploy procedures
- [x] OPERATIONS.md - Run procedures

### Implementation Guides (Stable)
- [x] SETUP_DEVELOPMENT.md - Dev setup
- [x] STRIPE_INTEGRATION.md - Payment setup
- [x] BACKGROUND_VIDEO.md - Video setup
- [x] PWA_CONFIGURATION.md - PWA setup

### Audit Reports (Current)
- [x] UX_AUDIT_2026-03-09.md - Latest UX findings
- [x] CODE_QUALITY_2026-03-08.md - Code review results
- [x] SECURITY_AUDIT_2026-03-09.md - Security findings

### Process Documents (Maintained)
- [x] BUILD_STANDARDS.md - Coding standards
- [x] TEST_STRATEGY.md - Testing approach
- [x] LESSONS_LEARNED.md - Historical incidents
- [x] BACKLOG.md - Product roadmap

---

## 🔄 Update Frequency

| Category | Frequency | Owner |
|----------|-----------|-------|
| Core Documentation | Quarterly | Tech Lead |
| Implementation Guides | As needed | Relevant team |
| Audit Reports | Monthly | QA Lead |
| Process Documents | Per sprint | Tech Lead |
| BACKLOG.md | Daily | Project Manager |

---

## ✅ Documentation Checklist

When adding new documentation:

- [ ] Place in correct category/directory
- [ ] Start with purpose statement
- [ ] Include audience indicator
- [ ] Add date of last update
- [ ] Cross-link to related docs
- [ ] Update DOCUMENTATION_ORGANIZATION.md
- [ ] Update DOCUMENTATION_INDEX.md
- [ ] Add to appropriate README section

---

## 🚀 Implementation Status

The documentation structure is being organized in phases:

**Phase 1 (Week 1) — Consolidate Duplicates** ✅ COMPLETE
- [x] Created DOCUMENTATION_ORGANIZATION.md (master reference)
- [x] Consolidated ARCHITECTURE.md (deleted docs/ version, now canonical root only)
- [x] Consolidated DEPLOY.md (deleted docs/ version, now canonical root only)
- [x] Updated DOCUMENTATION_INDEX.md with consolidated references

**Phase 2 (Week 2) — Create /guides Directory** ✅ COMPLETE
- [x] Created /guides directory structure
- [x] Created guides/README.md (index and navigation)
- [x] Created guides/SETUP_DEVELOPMENT.md (dev environment setup)
- [x] Created guides/ENVIRONMENT_VARIABLES.md (secrets & config reference)
- [x] Created guides/STRIPE_INTEGRATION.md (payment system setup)
- [x] Created guides/BACKGROUND_VIDEO.md (video implementation)
- [x] Created guides/PWA_CONFIGURATION.md (PWA offline support)
- [x] Created guides/EMBED_WIDGET.md (widget embedding)
- [x] Created /guides/advanced directory (placeholder)
- [x] Updated DOCUMENTATION_INDEX.md with guides links
- [x] Updated DOCUMENTATION_SUMMARY.md with guides inventory

**Phase 3 (Week 3) — Create /audits Directory** ✅ COMPLETE
- [x] Created /audits directory structure with /audits/archive
- [x] Moved 12 current audit reports to /audits directory
- [x] Moved 1 archived audit to /audits/archive
- [x] Created audits/README.md with audit index and role-based navigation
- [x] Updated DOCUMENTATION_INDEX.md with audits section
- [x] Updated DOCUMENTATION_SUMMARY.md with audits links

**Phase 4 (Week 4) — Create /process Directory** 🔄 READY TO START
- [ ] Create /process directory structure
- [ ] Move process docs to /process
- [ ] Update all cross-references

---

**Status:** In Progress  
**Owner:** Technical Lead  
**Last Review:** 2026-03-09
