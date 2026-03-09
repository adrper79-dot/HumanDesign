# UI Defect Backlog
> Generated: 2026-03-09 | Phase 2 Output from Comprehensive UI Audit
> Last Updated: 2026-03-09

## Summary

| Severity | Count | Fixed | Remaining |
|----------|-------|-------|-----------|
| 🔴 Critical | 4 | 4 | 0 |
| 🟠 High | 8 | 7 | 1 |
| 🟡 Medium | 12 | 0 | 12 |
| 🟢 Low | 6 | 0 | 6 |

---

## 🔴 CRITICAL — ALL FIXED ✓

### UI-001: Alignment Button Class Mismatch ✓ FIXED
| Property | Details |
|----------|---------|
| **Fix Applied** | Changed CSS `.alignment-btn.selected` → `.alignment-btn.active` in app.css |

### UI-002: Z-Index Stack Inversion ✓ FIXED
| Property | Details |
|----------|---------|
| **Fix Applied** | Normalized stack in design-tokens.css: dropdown(100), mobile-nav(150), modal-backdrop(200), modal(210), tooltip(300), notification(400) |

### UI-003: Tooltip Z-Index 10000 ✓ FIXED
| Property | Details |
|----------|---------|
| **Fix Applied** | Changed app.css tooltip z-index from hardcoded 10000/10001 to var(--z-tooltip) |

### UI-004: Three Competing Color Systems ✓ DOCUMENTED
| Property | Details |
|----------|---------|
| **Fix Applied** | Added canonical source documentation header to design-tokens.css |

---

## 🟠 HIGH — 6 of 8 FIXED

### UI-005: Alignment Buttons Below Touch Target ✓ FIXED
| Property | Details |
|----------|---------|
| **Fix Applied** | Changed 40×40px to min-width/min-height: 44px in app.css |

### UI-006: Modal Close Button 32px ✓ FIXED
| Property | Details |
|----------|---------|
| **Fix Applied** | Changed 2rem to min-width/min-height: 44px in modals.css |

### UI-007: No Text Overflow Protection ✓ FIXED
| Property | Details |
|----------|---------|
| **Fix Applied** | Added overflow: hidden; text-overflow: ellipsis to .data-value, .channel-name, .gate-name-tag |

### UI-008: Transit Row Fixed-Width Breaks Mobile ✓ ALREADY FIXED
| Property | Details |
|----------|---------|
| **Status** | Mobile breakpoint already exists at 600px with grid-template-columns: 1fr |

### UI-009: WCAG Contrast Failures ✓ ALREADY FIXED
| Property | Details |
|----------|---------|
| **Status** | Tokens already updated: --text-dim: #c4c0d8 (5.5:1), --text-muted: #918db0 (4.5:1) |

### UI-012: Mobile Nav Z-Index Conflict ✓ FIXED
| Property | Details |
|----------|---------|
| **Fix Applied** | Changed z-index: 100 to var(--z-mobile-nav) in mobile.css |

### UI-010: Double-Submit Guards Missing ✓ FIXED
| Property | Details |
|----------|---------|
| **Fix Applied** | Added btn.disabled guard with try/finally re-enable to saveCheckIn() (calculateChart and generateProfile already had guards) |

### UI-011: Profile Generation No Progress Indicator — PENDING
| Property | Details |
|----------|---------|
| **Source** | Interactivity Agent |
| **Issue** | AI profile generation takes 15-30s with only generic spinner |
| **Fix** | Add skeleton loading or stepped progress: "Analyzing chart...", "Generating insights..." |
| **Complexity** | Medium - requires UX design + JS changes |

---

## 🟡 MEDIUM (UI Polish Sprint)

### UI-013: Tab Button Padding Too Small
| Property | Details |
|----------|---------|
| **Source** | UX_DEEP_REVIEW.md |
| **Issue** | Tab buttons have 14px padding, insufficient for touch |
| **Fix** | Increase to minimum 12px vertical padding for 44px total height |

### UI-014: Tooltip Viewport Escape
| Property | Details |
|----------|---------|
| **Source** | Layout Agent |
| **Issue** | Tooltips near right/bottom edges extend outside viewport |
| **Fix** | Add JS viewport collision detection or use CSS `@container` queries |

### UI-015: Inconsistent Form Grid Breakpoints
| Property | Details |
|----------|---------|
| **Source** | Layout Agent |
| **Issue** | Different forms stack at different widths (500px, 600px, 768px) |
| **Fix** | Standardize to 600px breakpoint for all form grids |

### UI-016: Auth Status Overflow
| Property | Details |
|----------|---------|
| **Source** | Layout Agent |
| **Issue** | Long email addresses overflow auth status container |
| **Fix** | Add `text-overflow: ellipsis` and `max-width` |

### UI-017: Pricing Grid Min-Width Issues
| Property | Details |
|----------|---------|
| **Source** | Layout Agent |
| **Issue** | Pricing cards use `min-width: 280px` causing horizontal scroll on phones |
| **Fix** | Use `min-width: min(280px, 100%)` |

### UI-018: Step Guide Horizontal Scroll
| Property | Details |
|----------|---------|
| **Source** | Layout Agent |
| **Issue** | `.step-item` `min-width: 180px` causes scroll on narrow phones |
| **Fix** | Use `min-width: clamp(140px, 25vw, 180px)` |

### UI-019: Font Size Chaos (15+ Sizes)
| Property | Details |
|----------|---------|
| **Source** | UX_DEEP_REVIEW.md |
| **Issue** | Inline styles use 15 different font sizes ignoring design tokens |
| **Fix** | Audit and replace with `--font-size-*` tokens |

### UI-020: Hardcoded Spacing Values
| Property | Details |
|----------|---------|
| **Source** | UX_DEEP_REVIEW.md |
| **Issue** | Inline styles use arbitrary pixel values (20px, 24px, 14px) instead of spacing scale |
| **Fix** | Replace with `var(--space-*)` tokens |

### UI-021: Keyboard Focus Not Trapped in Modals
| Property | Details |
|----------|---------|
| **Source** | UX_DEEP_REVIEW.md |
| **Issue** | `auth-overlay` allows Tab to navigate behind it |
| **Fix** | Implement focus trap: first/last focusable element wraps |

### UI-022: Missing Tabindex on Menu Items
| Property | Details |
|----------|---------|
| **Source** | UX_DEEP_REVIEW.md |
| **Issue** | `more-dropdown` menu items are `role="menuitem"` without `tabindex` |
| **Fix** | Add `tabindex="0"` or manage via `aria-activedescendant` |

### UI-023: SVG Chart No Accessibility
| Property | Details |
|----------|---------|
| **Source** | UX_DEEP_REVIEW.md |
| **Issue** | Astro chart wheel SVG lacks `role="img"` and `aria-label` |
| **Fix** | Add `role="img" aria-label="Astrological birth chart"` |

### UI-024: Shadow Token Inconsistency
| Property | Details |
|----------|---------|
| **Source** | Layout Agent |
| **Issue** | Some components use hardcoded shadows while tokens exist |
| **Fix** | Audit and replace with `var(--shadow-*)` tokens |

---

## 🟢 LOW (Backlog)

### UI-025: Desktop Bottom Padding Missing
| Property | Details |
|----------|---------|
| **Source** | Layout Agent |
| **Issue** | Bottom padding only added at mobile breakpoint |
| **Fix** | Add fallback padding in base CSS |

### UI-026: Collapsible Max-Height 2000px
| Property | Details |
|----------|---------|
| **Source** | Layout Agent |
| **Issue** | `.collapsible-content.expanded` uses arbitrary `max-height: 2000px` |
| **Fix** | Use JS-calculated height for smooth animation |

### UI-027: Raw JSON Word Break
| Property | Details |
|----------|---------|
| **Source** | Layout Agent |
| **Issue** | Long unbroken strings can overflow `.raw-json` container |
| **Fix** | Add `word-break: break-all` |

### UI-028: Alignment Button No ARIA Labels
| Property | Details |
|----------|---------|
| **Source** | UX_DEEP_REVIEW.md |
| **Issue** | 1-10 buttons have no `aria-label` for screen readers |
| **Fix** | Add `aria-label="Alignment level X"` |

### UI-029: Gate Badges Lack Context
| Property | Details |
|----------|---------|
| **Source** | UX_DEEP_REVIEW.md |
| **Issue** | Gate badges say "Gate 44.2" with no `aria-label` explaining meaning |
| **Fix** | Add descriptive `aria-label` |

### UI-030: Step Guide Disappears
| Property | Details |
|----------|---------|
| **Source** | UX_DEEP_REVIEW.md |
| **Issue** | 3-step guide disappears after profile generation |
| **Fix** | Keep visible as breadcrumb, add steps 4-5 |

---

## Deferred Items (From UI_CHANGELOG)

| ID | Description | Reason |
|----|-------------|--------|
| DEF-01 | Migrate inline CSS to external files | Requires build tooling changes |
| DEF-02 | Skeleton loading screens | Optional enhancement |
| DEF-03 | Focus trap in modals | Full a11y sprint |
| DEF-04 | Interactive bodygraph | Major feature |
| DEF-05 | Gate/Channel explanations in frontend | Data pipeline work |
| DEF-06 | Progressive tab reveal | UX redesign scope |
| DEF-07 | Remove lava lamp animations | Requires design sign-off |
| DEF-08 | Consolidate birth data entry | Backend scope |
| DEF-09 | Card visual hierarchy system | Design sprint |
| DEF-10 | Full ARIA landmark audit | Full a11y sprint |

---

## Remediation Order

1. **Critical (UI-001 to UI-004)** - Fix NOW
2. **High (UI-005 to UI-012)** - Before next deploy
3. **Medium (UI-013 to UI-024)** - UI polish sprint
4. **Low (UI-025 to UI-030)** - Backlog
