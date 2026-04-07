# bank-link Edge Function

Provider-ready secure interface for bank linking, token exchange, and account sync.

## Actions

- `create_link_session`
  - Creates a short-lived link session and returns a provider link token.
- `exchange_public_token`
  - Exchanges a provider public token for a connection record.
- `sync_accounts`
  - Syncs connected bank accounts into `public.accounts`.
- `sync_transactions`
  - Syncs statement transactions into `public.transactions`.
- `get_connection_state`
  - Returns connector link state (`syncing`, `retry_scheduled`, `error`, etc.) with retry metadata.
- `retry_connection_sync`
  - Retries connector sync for `accounts`, `transactions`, or `all`.
- `import_statement`
  - Fallback statement import path (CSV/normalized rows) when provider linking is unavailable.
- `mock_mobile_verify`
  - MVP OTP flow used by current app UI (`123456` by default).

## Required secrets

Set these in Supabase project secrets:

- `BANK_LINK_PROVIDER` (`mock` by default)
- `BANK_LINK_MOCK_OTP` (optional, defaults to `123456`)

For real providers:

- `BANK_LINK_API_BASE_URL`
- `BANK_LINK_CLIENT_ID`
- `BANK_LINK_CLIENT_SECRET`
- `BANK_LINK_PARTNER_API_KEY` (optional)
- `BANK_LINK_PARTNER_BEARER_TOKEN` (optional)
- `BANK_LINK_CREATE_SESSION_ENDPOINT` (optional override)
- `BANK_LINK_EXCHANGE_ENDPOINT` (optional override)
- `BANK_LINK_SYNC_ENDPOINT`
- `BANK_LINK_TRANSACTIONS_ENDPOINT`
- `BANK_LINK_MAX_ATTEMPTS` (optional; default 3)
- `BANK_LINK_TIMEOUT_MS` (optional; default 9000)

Supabase runtime keys used automatically:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (recommended)

## Deploy

```bash
npx supabase functions deploy bank-link --project-ref dbcsfoezxznyprkrduld
```

## Local serve

```bash
npx supabase functions serve bank-link --env-file .env
```
