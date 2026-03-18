# Prime Self — Command Center

> **App:** [selfprime.net](https://selfprime.net) | **API:** prime-self-api.adrper79.workers.dev | **Updated:** 2026-03-18

---

## 🗺️ Navigation

| Section | Link | Purpose |
|---|---|---|
| Task Board | [[TASKS]] | All open issues by priority |
| Video Scripts | [[video-scripts/INDEX]] | Training video scripts by feature |
| Feature Matrix | [[features/INDEX]] | Full feature reference |
| Session Logs | [[sessions/INDEX]] | Dev session history |
| Projections | [[business/PROJECTIONS]] | Revenue model & market analysis |

---

## 🔴 Open P0 Issues
```tasks
not done
tags include #p0
group by tags
```

## 🟠 Open P1 Issues
```tasks
not done
tags include #p1
limit 10
```

---

## 📹 Video Script Status
```dataview
TABLE status, runtime, tier
FROM "obsidian/video-scripts"
WHERE file.name != "INDEX"
SORT file.name ASC
```

---

## 📊 Quick Stats

| Metric | Value |
|---|---|
| Tests Passing | 519 / 527 |
| Features Shipped | 40+ |
| Active Tiers | Free / Individual / Practitioner / Agency |
| Infrastructure | Cloudflare Workers + Neon + R2 |
| Monthly Infra Cost | ~$25–$245 (scales with users) |
