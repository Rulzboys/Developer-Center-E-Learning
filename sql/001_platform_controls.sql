-- EDULINK Owner Console V2 — jalankan sekali di Supabase SQL Editor.
-- Tidak menghapus atau mengganti tabel yang sudah ada. Lakukan backup terlebih dahulu.
-- 1. Pengaturan kontrol platform dan riwayat perubahan (server-managed).
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  mobile_enabled boolean NOT NULL DEFAULT true,
  maintenance_message text NOT NULL DEFAULT 'Aplikasi sedang dalam pemeliharaan. Silakan coba kembali nanti.'
    CHECK (char_length(maintenance_message) BETWEEN 1 AND 500),
  maintenance_starts_at timestamptz,
  maintenance_ends_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  CONSTRAINT maintenance_window CHECK (
    maintenance_ends_at IS NULL OR
    (maintenance_starts_at IS NOT NULL AND maintenance_ends_at > maintenance_starts_at)
  )
);
INSERT INTO public.platform_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_settings FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.platform_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('manual','schedule','clear_schedule')),
  before_data jsonb NOT NULL,
  after_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_audit_created_at_idx ON public.platform_audit(created_at DESC);
ALTER TABLE public.platform_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_audit FROM anon, authenticated;

-- 2. Preferensi susunan widget per akun Developer.
CREATE TABLE IF NOT EXISTS public.owner_dashboard_layouts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  widgets jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(widgets) = 'array'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.owner_dashboard_layouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_dashboard_layouts FROM anon, authenticated;
-- Akses preferensi saat ini dilakukan lewat Next.js server setelah verifikasi Developer.
-- Jika nanti perlu akses langsung dari klien, buat kebijakan RLS spesifik, jangan
-- membuka tabel ini secara global.

-- 3. Check status ringan, aman untuk anon, hanya mengembalikan informasi publik.
CREATE OR REPLACE FUNCTION public.platform_mobile_enabled() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT coalesce((SELECT s.mobile_enabled AND NOT
   (s.maintenance_starts_at IS NOT NULL AND s.maintenance_starts_at <= now()
    AND (s.maintenance_ends_at IS NULL OR s.maintenance_ends_at > now()))
  FROM public.platform_settings s WHERE s.id = true), false);
$$;
REVOKE ALL ON FUNCTION public.platform_mobile_enabled() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mobile_runtime_status() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT jsonb_build_object(
   'enabled', public.platform_mobile_enabled(),
   'message', s.maintenance_message,
   'checked_at', now(),
   'updated_at', s.updated_at
 ) FROM public.platform_settings s WHERE s.id = true;
$$;
REVOKE ALL ON FUNCTION public.mobile_runtime_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mobile_runtime_status() TO anon, authenticated;

-- 4. Developer only: server-side checks via auth.uid() — no client-side role trust.
CREATE OR REPLACE FUNCTION public.set_platform_controls(
  p_mobile_enabled boolean,
  p_message text,
  p_schedule_start timestamptz DEFAULT NULL,
  p_schedule_end timestamptz DEFAULT NULL,
  p_action text DEFAULT 'manual'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old_row public.platform_settings; new_row public.platform_settings;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id=auth.uid() AND p.active=true AND p.role='developer' AND p.tenant_id IS NULL)
  THEN RAISE EXCEPTION 'Akses Developer diperlukan.'; END IF;
  IF p_action NOT IN ('manual','schedule','clear_schedule')
  THEN RAISE EXCEPTION 'Aksi tidak dikenal.'; END IF;
  IF p_mobile_enabled IS NULL OR length(btrim(coalesce(p_message,''))) NOT BETWEEN 1 AND 500
  THEN RAISE EXCEPTION 'Status atau pesan maintenance tidak valid.'; END IF;
  IF p_schedule_start IS NOT NULL AND p_schedule_start <= now() AND p_action='schedule'
  THEN RAISE EXCEPTION 'Jadwal baru harus dimulai di masa depan.'; END IF;
  IF p_schedule_end IS NOT NULL AND (p_schedule_start IS NULL OR p_schedule_end <= p_schedule_start)
  THEN RAISE EXCEPTION 'Waktu selesai harus setelah waktu mulai.'; END IF;
  SELECT * INTO old_row FROM public.platform_settings WHERE id=true FOR UPDATE;
  UPDATE public.platform_settings SET mobile_enabled=p_mobile_enabled,
    maintenance_message=btrim(p_message),maintenance_starts_at=p_schedule_start,
    maintenance_ends_at=p_schedule_end,updated_by=auth.uid(),updated_at=now()
    WHERE id=true RETURNING * INTO new_row;
  INSERT INTO public.platform_audit(actor_id,action,before_data,after_data)
    VALUES(auth.uid(),p_action,to_jsonb(old_row),to_jsonb(new_row));
  RETURN jsonb_build_object('mobile_enabled',new_row.mobile_enabled,
    'effective_enabled',public.platform_mobile_enabled(),
    'maintenance_starts_at',new_row.maintenance_starts_at,
    'maintenance_ends_at',new_row.maintenance_ends_at);
END; $$;
REVOKE ALL ON FUNCTION public.set_platform_controls(boolean,text,timestamptz,timestamptz,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_platform_controls(boolean,text,timestamptz,timestamptz,text) TO authenticated;

-- 5. Penegakan di backend selain gate antarmuka Flutter:
--  fungsi lama mengecek tenant_active() sebelum memberi akses akademik/SPP.
CREATE OR REPLACE FUNCTION public.tenant_active(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT public.platform_mobile_enabled() AND EXISTS (
   SELECT 1 FROM public.tenants t
   WHERE t.id=p_id AND t.status='active' AND t.expires_at>now()
 );
$$;

-- Pastikan PostgREST melihat RPC / tabel baru setelah migration.
NOTIFY pgrst, 'reload schema';
