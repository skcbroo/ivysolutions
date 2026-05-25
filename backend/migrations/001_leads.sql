CREATE TABLE leads (
    id          BIGSERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    name        TEXT        NOT NULL,
    email       TEXT        NOT NULL,
    phone       TEXT        NOT NULL,
    ip          INET,
    user_agent  TEXT,
    referer     TEXT
);

CREATE INDEX leads_created_at_idx ON leads (created_at DESC);
CREATE INDEX leads_email_idx     ON leads (email);
