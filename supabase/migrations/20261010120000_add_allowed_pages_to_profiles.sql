/*
# Add per-user page access (allowed_pages)

## Overview
Adds an optional list of navigation pages each user is allowed to access.

## Modified Tables
1. `profiles`
- Adds `allowed_pages` (text[]): array of page keys (e.g. dashboard, schedule, users).
- NULL or empty array = full access (no restriction).
- Values are validated against the known page keys by the create-user / update-user edge functions.

## Security
- No RLS changes required: existing profile policies already cover the new column.
- New users created by the signup trigger get NULL (full access) until an admin restricts them.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS allowed_pages text[];
