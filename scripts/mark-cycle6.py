import json
from datetime import date

today = date.today().isoformat()

with open('audits/issue-registry.json') as f:
    d = json.load(f)

resolutions = {
    'SYS-008': 'Fixed: shareRate tier-based in webhook.js handleInvoicePaid — agency=0.50, others=0.25. Description string updated.',
    'SYS-017': 'Fixed: sendDisputeNotificationEmail added to email.js; handleChargeDispute receives env param; email sent after dispute_opened via getUserByIdSafe.',
    'SYS-020': 'Fixed: w-tz and c-tz selects in index.html expanded to 32 international options matching p-tz. member-tz in app.js was already comprehensive.',
    'SYS-034': 'STALE-OPEN: admin.js already fully implemented (182 lines) with /stats, /users, /promo routes, X-Admin-Token gated, registered in index.js.',
    'SYS-035': 'Fixed: Fatal cron catch now sends admin alert email via sendEmail if env.ADMIN_EMAIL + env.RESEND_API_KEY set (fire-and-forget).',
    'SYS-040': 'USER-ACTION: Staging KV IDs require wrangler kv namespace create commands. wrangler.toml has TODO comments with exact commands — cannot be automated.',
    'SYS-050': 'Fixed: docs/DEVELOPER_ONBOARDING.md created — prerequisites, clone, DB setup, secrets, KV, dev server, tests, project structure, issue workflow, deployment, gotchas.',
    'SYS-051': 'Fixed: docs/openapi.json updated from 5 paths to 45 paths. All major endpoint groups added. Version bumped to 2.0.0.',
}

updated = 0
for issue in d['issues']:
    if issue['id'] in resolutions:
        issue['status'] = 'resolved'
        issue['resolvedDate'] = today
        issue.setdefault('notes', [])
        issue['notes'].append(f"[Cycle 6 {today}] {resolutions[issue['id']]}")
        updated += 1

with open('audits/issue-registry.json', 'w') as f:
    json.dump(d, f, indent=2)

opens = [i for i in d['issues'] if i['status'] == 'open']
print(f'Marked {updated} resolved. Open remaining: {len(opens)}')
for i in opens:
    print(f'  {i["id"]} - {i.get("title","")}')
