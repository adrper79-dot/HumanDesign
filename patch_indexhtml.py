#!/usr/bin/env python3
"""Patch frontend/index.html to add portalMessagesCard + portalJourneyCard."""
import sys

PATH = "/mnt/c/Users/Ultimate Warrior/My project/HumanDesign/frontend/index.html"

with open(PATH, 'rb') as f:
    data = f.read()

# Old: closing tags for portalSharedNotes then portalDetailView
OLD = (
    b'      </div>\r\n'
    b'    </div>\r\n'
    b'\r\n'
    b'    <!-- All shared notes across practitioners -->'
)

# Verify it's unique
count = data.count(OLD)
if count != 1:
    print(f"ERROR: anchor found {count} times (expected 1)")
    sys.exit(1)

NEW = (
    b'      </div>\r\n'
    b'      <div id="portalMessagesCard" class="card" style="display:none">\r\n'
    b'        <div class="card-title">&#x1F4AC; Messages</div>\r\n'
    b'        <div id="portalMessagesContent" aria-live="polite"></div>\r\n'
    b'        <div style="display:flex;gap:var(--space-2);margin-top:var(--space-3)">\r\n'
    b'          <textarea id="portalMsgInput" rows="2" class="form-input" placeholder="Write a message\xe2\x80\xa6" maxlength="2000" style="flex:1;resize:none"></textarea>\r\n'
    b'          <button class="btn-primary btn-sm" id="portalMsgSendBtn">Send</button>\r\n'
    b'        </div>\r\n'
    b'        <div id="portalMsgStatus" style="font-size:var(--font-size-sm);color:var(--text-dim);margin-top:var(--space-1)"></div>\r\n'
    b'      </div>\r\n'
    b'      <div id="portalJourneyCard" class="card" style="display:none">\r\n'
    b'        <div class="card-title">&#x1F5FA;&#xFE0F; Your Journey</div>\r\n'
    b'        <div id="portalJourneyContent"></div>\r\n'
    b'      </div>\r\n'
    b'    </div>\r\n'
    b'\r\n'
    b'    <!-- All shared notes across practitioners -->'
)

patched = data.replace(OLD, NEW, 1)
if patched == data:
    print("ERROR: No change was made")
    sys.exit(1)

with open(PATH, 'wb') as f:
    f.write(patched)

print(f"SUCCESS: {len(data)} -> {len(patched)} (+{len(patched)-len(data)})")
