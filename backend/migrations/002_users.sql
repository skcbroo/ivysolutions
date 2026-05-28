CREATE TABLE users (
    id            BIGSERIAL    PRIMARY KEY,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    email         TEXT         NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,
    nome          TEXT
);

CREATE INDEX users_email_idx ON users (email);
