/*
# Add editable application logo

## Overview
Adds a public `branding` storage area so administrators can replace the
default application logo shown in the sidebar / top bar.

## New Storage
1. `branding` bucket
- Public bucket for brand assets (application logo and brand settings).
- Accepts JPEG, PNG, and WebP images up to 2 MB, plus `application/json`
  (the `app/settings.json` file that stores the brand name and subtitle).

## Security
- Authenticated users may view brand assets so the signed-in application can
  display the logo.
- Only authenticated administrators may upload, replace, or delete brand
  assets.
- Storage object paths are scoped to the single `app` folder.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('branding', 'branding', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/json']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/json']::text[];

DROP POLICY IF EXISTS "branding_select_authenticated" ON storage.objects;
CREATE POLICY "branding_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'branding');

DROP POLICY IF EXISTS "branding_insert_admin" ON storage.objects;
CREATE POLICY "branding_insert_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'branding'
    AND (storage.foldername(name))[1] = 'app'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "branding_update_admin" ON storage.objects;
CREATE POLICY "branding_update_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'branding'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'branding'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "branding_delete_admin" ON storage.objects;
CREATE POLICY "branding_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'branding'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
