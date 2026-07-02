# Schema tests

`smoke_test.sql` exercises the core business rules directly against the schema
(verification gating, conflict-of-interest blocking, current-employee rating
ban, weighted score views, duplicate prevention, company-rep labeling, trust
signal admin gate, audit logging). Everything runs inside a transaction that is
rolled back.

Run against any vanilla Postgres 16 (no Supabase needed —
`stub_supabase.sql` fakes the `auth`/`storage` schemas):

```bash
createdb marineiq_test
psql -d marineiq_test -v ON_ERROR_STOP=1 \
  -f supabase/tests/stub_supabase.sql \
  -f supabase/migrations/0001_schema.sql \
  -f supabase/migrations/0002_functions_triggers_views.sql \
  -f supabase/migrations/0003_rls_storage.sql \
  -f supabase/seed.sql \
  -f supabase/tests/smoke_test.sql
```

Expected output ends with `=== ALL SMOKE TESTS PASSED ===`.
Do not run `stub_supabase.sql` against a real Supabase project.
