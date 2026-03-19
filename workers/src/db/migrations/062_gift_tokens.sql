-- Migration 062: Gift-a-Reading token table (item 4.6)
-- Practitioners generate shareable gift URLs; recipients redeem them to claim
-- a free chart + profile synthesis session.

CREATE TABLE IF NOT EXISTS gift_tokens (
  id              BIGSERIAL PRIMARY KEY,
  token           TEXT        NOT NULL UNIQUE,
  practitioner_id BIGINT      NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  message         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '90 days',
  redeemed_at     TIMESTAMPTZ,
  redeemed_by     BIGINT      REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS gift_tokens_token_idx          ON gift_tokens(token);
CREATE INDEX IF NOT EXISTS gift_tokens_practitioner_idx   ON gift_tokens(practitioner_id);
CREATE INDEX IF NOT EXISTS gift_tokens_unredeemed_idx     ON gift_tokens(practitioner_id) WHERE redeemed_at IS NULL;
