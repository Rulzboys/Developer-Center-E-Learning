-- EDULINK Owner Console V3. Apply AFTER 001_platform_controls.sql on a backup/staging DB.
-- Do not reimport supabase_backup.sql. Does NOT weaken existing non-developer access policies.
BEGIN;
CREATE TABLE IF NOT EXISTS public.owner_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
 resource text NOT NULL,
 action text NOT NULL CHECK (action IN ('create','update','delete','reconcile')),
 record_id uuid NOT NULL,
 before_data jsonb,
 after_data jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS owner_audit_recent ON public.owner_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS owner_audit_tenant ON public.owner_audit(tenant_id,created_at DESC);
ALTER TABLE public.owner_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.owner_audit FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.is_platform_developer() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='developer' AND active AND tenant_id IS NULL);
$$;
REVOKE ALL ON FUNCTION public.is_platform_developer() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_developer() TO authenticated;

-- Read-only owner visibility; all writes go via narrowly validated, audited RPCs below.
-- Existing policies for admin/leader/teacher/student remain in place unchanged.
DROP POLICY IF EXISTS owner_profiles_read ON public.profiles;
CREATE POLICY owner_profiles_read ON public.profiles FOR SELECT TO authenticated USING (public.is_platform_developer());
DROP POLICY IF EXISTS owner_learning_read ON public.learning_entities;
CREATE POLICY owner_learning_read ON public.learning_entities FOR SELECT TO authenticated USING (public.is_platform_developer());
DROP POLICY IF EXISTS owner_invoices_read ON public.spp_invoices;
CREATE POLICY owner_invoices_read ON public.spp_invoices FOR SELECT TO authenticated USING (public.is_platform_developer());
DROP POLICY IF EXISTS owner_payments_read ON public.spp_payments;
CREATE POLICY owner_payments_read ON public.spp_payments FOR SELECT TO authenticated USING (public.is_platform_developer());
DROP POLICY IF EXISTS owner_qris_read ON public.spp_qris_settings;
CREATE POLICY owner_qris_read ON public.spp_qris_settings FOR SELECT TO authenticated USING (public.is_platform_developer());
DROP POLICY IF EXISTS owner_gateway_read ON public.spp_gateway_settings;
CREATE POLICY owner_gateway_read ON public.spp_gateway_settings FOR SELECT TO authenticated USING (public.is_platform_developer());
DROP POLICY IF EXISTS owner_spp_audit_read ON public.spp_audit;
CREATE POLICY owner_spp_audit_read ON public.spp_audit FOR SELECT TO authenticated USING (public.is_platform_developer());
DROP POLICY IF EXISTS owner_audit_read ON public.owner_audit;
CREATE POLICY owner_audit_read ON public.owner_audit FOR SELECT TO authenticated USING (public.is_platform_developer());
GRANT SELECT ON TABLE public.owner_audit TO authenticated;

-- Explicit owner operations preserve audit history and dependencies.
CREATE OR REPLACE FUNCTION public.owner_profile_action(p_action text,p_profile jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_row public.profiles; new_row public.profiles; target_id uuid; tenant uuid; role_name text;
BEGIN
 IF NOT public.is_platform_developer() THEN RAISE EXCEPTION 'Akses Developer diperlukan'; END IF;
 IF p_action NOT IN ('save','delete') OR jsonb_typeof(p_profile) <> 'object' THEN RAISE EXCEPTION 'Permintaan tidak valid'; END IF;
 target_id := (p_profile->>'id')::uuid;
 IF target_id IS NULL OR target_id=auth.uid() THEN RAISE EXCEPTION 'Kelola profil sendiri dari menu Profil Developer'; END IF;
 SELECT * INTO old_row FROM public.profiles WHERE id=target_id FOR UPDATE;
 IF p_action='delete' THEN
  IF old_row.id IS NULL THEN RAISE EXCEPTION 'Akun tidak ditemukan'; END IF;
  -- Auth Admin deletion (server) occurs after RPC. All referring records must be detached first.
  IF EXISTS(SELECT 1 FROM public.learning_entities e WHERE e.author_id=target_id OR e.data->>'studentId'=target_id::text OR e.data->>'teacherId'=target_id::text)
   OR EXISTS(SELECT 1 FROM public.spp_invoices WHERE student_id=target_id OR created_by=target_id)
   OR EXISTS(SELECT 1 FROM public.spp_payments WHERE student_id=target_id OR created_by=target_id OR reviewed_by=target_id)
   OR EXISTS(SELECT 1 FROM public.subscription_orders WHERE buyer_id=target_id)
   OR EXISTS(SELECT 1 FROM public.spp_qris_settings WHERE created_by=target_id)
   OR EXISTS(SELECT 1 FROM public.spp_gateway_settings WHERE created_by=target_id)
   OR EXISTS(SELECT 1 FROM public.spp_audit WHERE actor_id=target_id)
   OR EXISTS(SELECT 1 FROM public.owner_audit WHERE actor_id=target_id)
   OR EXISTS(SELECT 1 FROM public.platform_audit WHERE actor_id=target_id)
   OR EXISTS(SELECT 1 FROM public.platform_settings WHERE updated_by=target_id)
   OR EXISTS(SELECT 1 FROM public.subscription_settings WHERE updated_by=target_id)
  THEN RAISE EXCEPTION 'Akun memiliki riwayat. Nonaktifkan agar data dan audit tidak hilang'; END IF;
  INSERT INTO public.owner_audit(actor_id,tenant_id,resource,action,record_id,before_data)
   VALUES(auth.uid(),old_row.tenant_id,'profiles','delete',target_id,to_jsonb(old_row));
  DELETE FROM public.profiles WHERE id=target_id;
  RETURN jsonb_build_object('id',target_id,'deleted',true);
 END IF;
 role_name := p_profile->>'role';tenant := NULLIF(p_profile->>'tenant_id','')::uuid;
 IF role_name NOT IN ('developer','leader','admin','teacher','student') OR (role_name='developer') IS DISTINCT FROM (tenant IS NULL)
 THEN RAISE EXCEPTION 'Kombinasi role dan instansi tidak valid'; END IF;
 IF tenant IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=tenant) THEN RAISE EXCEPTION 'Instansi tidak ditemukan'; END IF;
 IF length(btrim(coalesce(p_profile->>'name',''))) NOT BETWEEN 1 AND 160 OR
    coalesce(p_profile->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR
    length(coalesce(p_profile->>'phone','')) > 40 OR length(coalesce(p_profile->>'number',''))>80
 THEN RAISE EXCEPTION 'Nama, email, nomor atau telepon tidak valid'; END IF;
 IF old_row.id IS NOT NULL THEN
  IF old_row.tenant_id IS DISTINCT FROM tenant AND (
     EXISTS(SELECT 1 FROM public.learning_entities WHERE author_id=target_id OR data->>'studentId'=target_id::text OR data->>'teacherId'=target_id::text)
     OR EXISTS(SELECT 1 FROM public.spp_invoices WHERE student_id=target_id OR created_by=target_id)
     OR EXISTS(SELECT 1 FROM public.spp_payments WHERE student_id=target_id OR created_by=target_id OR reviewed_by=target_id)
     OR EXISTS(SELECT 1 FROM public.spp_qris_settings WHERE created_by=target_id)
     OR EXISTS(SELECT 1 FROM public.spp_gateway_settings WHERE created_by=target_id)
     OR EXISTS(SELECT 1 FROM public.spp_audit WHERE actor_id=target_id)
     OR EXISTS(SELECT 1 FROM public.subscription_orders WHERE buyer_id=target_id)
     OR EXISTS(SELECT 1 FROM public.owner_audit WHERE actor_id=target_id))
  THEN RAISE EXCEPTION 'Akun memiliki data; instansi tidak dapat dipindahkan'; END IF;
  IF old_row.role IS DISTINCT FROM role_name AND (
     EXISTS(SELECT 1 FROM public.learning_entities WHERE data->>'studentId'=target_id::text OR data->>'teacherId'=target_id::text)
     OR EXISTS(SELECT 1 FROM public.spp_invoices WHERE student_id=target_id))
  THEN RAISE EXCEPTION 'Role tidak dapat diganti saat masih terkait kelas/riwayat'; END IF;
  IF old_row.email IS DISTINCT FROM lower(p_profile->>'email') THEN RAISE EXCEPTION 'Gunakan email lama; perubahan email Auth memerlukan alur verifikasi terpisah'; END IF;
 END IF;
 IF role_name <> 'student' AND nullif(p_profile->>'class_id','') IS NOT NULL THEN RAISE EXCEPTION 'Hanya siswa memiliki kelas'; END IF;
 IF nullif(p_profile->>'class_id','') IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.learning_entities WHERE id=(p_profile->>'class_id')::uuid AND tenant_id=tenant AND kind='classroom'
 ) THEN RAISE EXCEPTION 'Kelas tidak termasuk instansi yang dipilih'; END IF;
 IF old_row.id IS NOT NULL AND old_row.class_id IS DISTINCT FROM nullif(p_profile->>'class_id','')::uuid
  AND EXISTS(SELECT 1 FROM public.learning_entities WHERE data->>'studentId'=target_id::text)
 THEN RAISE EXCEPTION 'Siswa mempunyai riwayat; kelas tidak boleh dipindahkan'; END IF;
 IF NOT coalesce((p_profile->>'active')::boolean,true) AND EXISTS(
   SELECT 1 FROM public.learning_entities WHERE kind='classroom' AND data->>'teacherId'=target_id::text)
 THEN RAISE EXCEPTION 'Pindahkan guru pembimbing sebelum menonaktifkan'; END IF;
 INSERT INTO public.profiles(id,tenant_id,name,email,role,class_id,number,phone,active,photo_path)
 VALUES(target_id,tenant,btrim(p_profile->>'name'),lower(p_profile->>'email'),role_name,nullif(p_profile->>'class_id','')::uuid,
   coalesce(p_profile->>'number',''),coalesce(p_profile->>'phone',''),coalesce((p_profile->>'active')::boolean,true),coalesce(old_row.photo_path,''))
 ON CONFLICT(id) DO UPDATE SET tenant_id=excluded.tenant_id,name=excluded.name,role=excluded.role,
   class_id=excluded.class_id,number=excluded.number,phone=excluded.phone,active=excluded.active
 RETURNING * INTO new_row;
 INSERT INTO public.owner_audit(actor_id,tenant_id,resource,action,record_id,before_data,after_data)
 VALUES(auth.uid(),new_row.tenant_id,'profiles',CASE WHEN old_row.id IS NULL THEN 'create' ELSE 'update' END,target_id,to_jsonb(old_row),to_jsonb(new_row));
 RETURN to_jsonb(new_row);
END; $$;
REVOKE ALL ON FUNCTION public.owner_profile_action(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_profile_action(text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_entity_action(p_action text,p_entity jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_row public.learning_entities; out_row public.learning_entities; tid uuid; ident uuid; k text; d jsonb;
 cid uuid; subj uuid; sid uuid; teacher uuid; assignment public.learning_entities; ref_key text;
BEGIN
 IF NOT public.is_platform_developer() THEN RAISE EXCEPTION 'Akses Developer diperlukan'; END IF;
 IF p_action NOT IN ('save','delete') OR jsonb_typeof(p_entity)<>'object' THEN RAISE EXCEPTION 'Permintaan tidak valid'; END IF;
 ident := (p_entity->>'id')::uuid;
 IF ident IS NULL THEN RAISE EXCEPTION 'ID diperlukan'; END IF;
 -- Keep the same lock ordering as save_learning_entity: tenant before record.
 SELECT tenant_id INTO tid FROM public.learning_entities WHERE id=ident;
 IF tid IS NULL AND p_action='save' THEN tid:=nullif(p_entity->>'tenant_id','')::uuid; END IF;
 IF tid IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended(tid::text,0)); END IF;
 SELECT * INTO old_row FROM public.learning_entities WHERE id=ident FOR UPDATE;
 IF p_action='delete' THEN
  IF old_row.id IS NULL THEN RAISE EXCEPTION 'Data tidak ditemukan'; END IF;
  ref_key:=CASE old_row.kind WHEN 'classroom' THEN 'classId' WHEN 'subject' THEN 'subjectId' WHEN 'assignment' THEN 'assignmentId' END;
  IF (ref_key IS NOT NULL AND EXISTS(SELECT 1 FROM public.learning_entities e WHERE e.tenant_id=old_row.tenant_id AND e.data->>ref_key=ident::text))
     OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.class_id=ident)
  THEN RAISE EXCEPTION 'Data masih memiliki relasi. Pindahkan atau arsipkan data terkait terlebih dahulu'; END IF;
  INSERT INTO public.owner_audit(actor_id,tenant_id,resource,action,record_id,before_data)
   VALUES(auth.uid(),old_row.tenant_id,old_row.kind,'delete',ident,to_jsonb(old_row));
  DELETE FROM public.learning_entities WHERE id=ident;
  RETURN jsonb_build_object('id',ident,'deleted',true);
 END IF;
 tid := (p_entity->>'tenant_id')::uuid;k:=p_entity->>'kind';d:=p_entity->'data';
 IF NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=tid) OR k NOT IN
  ('classroom','subject','announcement','material','schedule','assignment','submission','memorization','attendance')
  OR jsonb_typeof(d)<>'object' OR octet_length(d::text)>30000 THEN RAISE EXCEPTION 'Data / instansi tidak valid'; END IF;
 IF old_row.id IS NOT NULL AND (old_row.tenant_id IS DISTINCT FROM tid OR old_row.kind IS DISTINCT FROM k)
 THEN RAISE EXCEPTION 'Jenis dan instansi riwayat tidak dapat dipindahkan'; END IF;
 IF k IN ('classroom','subject') AND length(btrim(coalesce(d->>'name',''))) NOT BETWEEN 1 AND 160
 THEN RAISE EXCEPTION 'Nama wajib diisi (maksimal 160)'; END IF;
 IF k IN ('announcement','material','schedule','assignment','memorization')
   AND length(btrim(coalesce(d->>'title',''))) NOT BETWEEN 1 AND 200
 THEN RAISE EXCEPTION 'Judul wajib diisi'; END IF;
 IF k IN ('announcement','material') AND length(btrim(coalesce(d->>'content','')))=0
 THEN RAISE EXCEPTION 'Konten wajib diisi'; END IF;
 cid:=nullif(d->>'classId','')::uuid;
 IF k NOT IN ('classroom','subject','announcement') OR cid IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM public.learning_entities WHERE id=cid AND tenant_id=tid AND kind='classroom')
  THEN RAISE EXCEPTION 'Kelas tidak ditemukan di instansi ini'; END IF;
 END IF;
 IF k='classroom' THEN
  teacher:=nullif(d->>'teacherId','')::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=teacher AND tenant_id=tid AND role='teacher' AND active)
    OR coalesce(d->>'targetCount','') !~ '^[0-9]{1,4}$' OR (d->>'targetCount')::int NOT BETWEEN 1 AND 1000
    OR length(btrim(coalesce(d->>'academicYear','')))=0 THEN
    RAISE EXCEPTION 'Guru aktif, target dan tahun ajaran wajib valid'; END IF;
 END IF;
 IF k IN ('assignment','material','schedule') THEN
   subj:=nullif(d->>'subjectId','')::uuid;
   IF NOT EXISTS(SELECT 1 FROM public.learning_entities WHERE id=subj AND tenant_id=tid AND kind='subject')
   THEN RAISE EXCEPTION 'Mata pelajaran tidak ditemukan'; END IF;
   SELECT nullif(data->>'teacherId','')::uuid INTO teacher FROM public.learning_entities WHERE id=cid;
   d:=d||jsonb_build_object('teacherId',teacher);
 END IF;
 IF k IN ('attendance','memorization','submission') THEN
  sid:=nullif(d->>'studentId','')::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=sid AND tenant_id=tid AND role='student' AND class_id=cid)
  THEN RAISE EXCEPTION 'Siswa harus berasal dari kelas dan instansi yang dipilih'; END IF;
  IF old_row.id IS NOT NULL AND
    (old_row.data->>'studentId' IS DISTINCT FROM sid::text OR old_row.data->>'classId' IS DISTINCT FROM cid::text)
  THEN RAISE EXCEPTION 'Identitas siswa dan kelas pada riwayat tidak dapat diganti'; END IF;
 END IF;
 IF k='announcement' AND coalesce(d->>'audience','') NOT IN ('all','teacher','student','admin') THEN
   RAISE EXCEPTION 'Penerima pengumuman tidak valid'; END IF;
 IF k='assignment' THEN
   IF length(btrim(coalesce(d->>'description','')))=0 OR nullif(d->>'dueAt','') IS NULL THEN RAISE EXCEPTION 'Instruksi dan jatuh tempo wajib diisi'; END IF;
   PERFORM (d->>'dueAt')::timestamptz;
   IF old_row.id IS NOT NULL AND d->>'classId' IS DISTINCT FROM old_row.data->>'classId' AND EXISTS(
      SELECT 1 FROM public.learning_entities WHERE kind='submission' AND data->>'assignmentId'=ident::text
   ) THEN RAISE EXCEPTION 'Tugas mempunyai jawaban; kelas tidak dapat diganti'; END IF;
 END IF;
 IF k='attendance' THEN
  IF d->>'status' NOT IN ('Hadir','Izin','Sakit','Alpa') OR coalesce(d->>'date','') !~ '^\d{4}-\d{2}-\d{2}$'
  THEN RAISE EXCEPTION 'Tanggal atau status absensi tidak valid'; END IF;
  PERFORM (d->>'date')::date;
 END IF;
 IF k='memorization' THEN
  IF coalesce(d->>'fluency','') !~ '^[0-9]{1,3}$' OR coalesce(d->>'tajwid','') !~ '^[0-9]{1,3}$'
   OR coalesce(d->>'makhraj','') !~ '^[0-9]{1,3}$' OR
   (d->>'fluency')::int>100 OR (d->>'tajwid')::int>100 OR (d->>'makhraj')::int>100
   OR coalesce(d->>'startVerse','') !~ '^[0-9]+$' OR coalesce(d->>'endVerse','') !~ '^[0-9]+$'
   OR (d->>'startVerse')::int<1 OR (d->>'endVerse')::int<(d->>'startVerse')::int
   OR d->>'status' NOT IN ('inProgress','review','completed')
  THEN RAISE EXCEPTION 'Nilai, ayat atau status hafalan tidak valid'; END IF;
  SELECT nullif(data->>'teacherId','')::uuid INTO teacher FROM public.learning_entities WHERE id=cid;
  d:=d||jsonb_build_object('teacherId',teacher,'unitKey',lower(btrim(d->>'title'))||'|'||(d->>'startVerse')||'|'||(d->>'endVerse'));
 END IF;
 IF k='submission' THEN
  SELECT * INTO assignment FROM public.learning_entities WHERE id=nullif(d->>'assignmentId','')::uuid AND kind='assignment' AND tenant_id=tid;
  IF assignment.id IS NULL OR assignment.data->>'classId' IS DISTINCT FROM cid::text OR
     length(btrim(coalesce(d->>'answer','')))=0 THEN RAISE EXCEPTION 'Tugas, kelas, atau jawaban tidak valid'; END IF;
  IF old_row.id IS NOT NULL AND old_row.data->>'assignmentId' IS DISTINCT FROM d->>'assignmentId' THEN
     RAISE EXCEPTION 'Tugas pada jawaban lama tidak dapat diganti'; END IF;
  IF d ? 'score' AND (coalesce(d->>'score','') !~ '^[0-9]{1,3}$' OR (d->>'score')::int>100)
  THEN RAISE EXCEPTION 'Nilai harus 0–100'; END IF;
  d:=d||jsonb_build_object('submittedAt',coalesce(old_row.data->'submittedAt',to_jsonb(now())));
 END IF;
 IF k='schedule' THEN
  IF coalesce(d->>'weekday','') !~ '^[1-7]$' OR coalesce(d->>'startTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR
   coalesce(d->>'endTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR d->>'startTime'>=d->>'endTime'
  THEN RAISE EXCEPTION 'Hari dan jam tidak valid'; END IF;
  IF EXISTS(SELECT 1 FROM public.learning_entities e WHERE e.kind='schedule' AND e.tenant_id=tid AND e.id<>ident
    AND e.data->>'weekday'=d->>'weekday' AND (e.data->>'classId'=d->>'classId' OR e.data->>'teacherId'=d->>'teacherId')
    AND e.data->>'startTime'<d->>'endTime' AND e.data->>'endTime'>d->>'startTime')
  THEN RAISE EXCEPTION 'Jadwal berbenturan'; END IF;
 END IF;
 INSERT INTO public.learning_entities(id,tenant_id,kind,data,author_id,created_at)
 VALUES(ident,tid,k,d,coalesce(old_row.author_id,auth.uid()),coalesce(old_row.created_at,now()))
 ON CONFLICT(id) DO UPDATE SET data=excluded.data RETURNING * INTO out_row;
 INSERT INTO public.owner_audit(actor_id,tenant_id,resource,action,record_id,before_data,after_data)
 VALUES(auth.uid(),tid,k,CASE WHEN old_row.id IS NULL THEN 'create' ELSE 'update' END,ident,to_jsonb(old_row),to_jsonb(out_row));
 RETURN to_jsonb(out_row);
END; $$;
REVOKE ALL ON FUNCTION public.owner_entity_action(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_entity_action(text,jsonb) TO authenticated;

-- Finance: invoices can be edited/deleted only when no payment exists. Never fabricate gateway settlement.
CREATE OR REPLACE FUNCTION public.owner_invoice_action(p_action text,p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_row public.spp_invoices; out_row public.spp_invoices; ident uuid; tid uuid; sid uuid;
BEGIN
 IF NOT public.is_platform_developer() THEN RAISE EXCEPTION 'Akses Developer diperlukan'; END IF;
 ident:=(p_data->>'id')::uuid;
 IF ident IS NULL OR p_action NOT IN ('save','delete','archive') THEN RAISE EXCEPTION 'Permintaan tidak valid'; END IF;
 -- Serialize with spp_action, which takes the tenant advisory lock first.
 SELECT tenant_id INTO tid FROM public.spp_invoices WHERE id=ident;
 IF tid IS NULL AND p_action='save' THEN tid:=nullif(p_data->>'tenant_id','')::uuid; END IF;
 IF tid IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended(tid::text,0)); END IF;
 SELECT * INTO old_row FROM public.spp_invoices WHERE id=ident FOR UPDATE;
 IF p_action='delete' THEN
  IF old_row.id IS NULL THEN RAISE EXCEPTION 'Tagihan tidak ditemukan'; END IF;
  IF EXISTS(SELECT 1 FROM public.spp_payments WHERE invoice_id=ident) THEN RAISE EXCEPTION 'Tagihan mempunyai transaksi, gunakan arsip'; END IF;
  INSERT INTO public.owner_audit(actor_id,tenant_id,resource,action,record_id,before_data)
   VALUES(auth.uid(),old_row.tenant_id,'spp_invoices','delete',ident,to_jsonb(old_row));
  DELETE FROM public.spp_invoices WHERE id=ident;
  RETURN jsonb_build_object('deleted',true);
 END IF;
 IF p_action='archive' THEN
   IF old_row.id IS NULL THEN RAISE EXCEPTION 'Tagihan tidak ditemukan'; END IF;
   UPDATE public.spp_invoices SET archived=NOT old_row.archived WHERE id=ident RETURNING * INTO out_row;
   INSERT INTO public.owner_audit(actor_id,tenant_id,resource,action,record_id,before_data,after_data)
     VALUES(auth.uid(),old_row.tenant_id,'spp_invoices','update',ident,to_jsonb(old_row),to_jsonb(out_row));
   RETURN to_jsonb(out_row);
 END IF;
 tid:=(p_data->>'tenant_id')::uuid;sid:=(p_data->>'student_id')::uuid;
 IF old_row.id IS NOT NULL AND EXISTS(SELECT 1 FROM public.spp_payments WHERE invoice_id=ident)
 THEN RAISE EXCEPTION 'Tagihan memiliki transaksi; tidak boleh diubah'; END IF;
 IF old_row.id IS NOT NULL AND (old_row.tenant_id<>tid OR old_row.student_id<>sid)
 THEN RAISE EXCEPTION 'Instansi dan siswa tagihan tidak dapat diganti'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=sid AND tenant_id=tid AND role='student' AND active)
  OR length(btrim(coalesce(p_data->>'title',''))) NOT BETWEEN 1 AND 160
  OR length(btrim(coalesce(p_data->>'period',''))) NOT BETWEEN 1 AND 60
  OR coalesce(p_data->>'amount','') !~ '^[0-9]+$' OR (p_data->>'amount')::int NOT BETWEEN 1 AND 1000000000
  OR nullif(p_data->>'due_date','') IS NULL
 THEN RAISE EXCEPTION 'Siswa, nominal, judul, periode atau tenggat tidak valid'; END IF;
 PERFORM (p_data->>'due_date')::date;
 INSERT INTO public.spp_invoices(id,tenant_id,student_id,title,period,amount,due_date,allow_partial,archived,created_by)
 VALUES(ident,tid,sid,btrim(p_data->>'title'),btrim(p_data->>'period'),(p_data->>'amount')::int,(p_data->>'due_date')::date,
  coalesce((p_data->>'allow_partial')::boolean,true),coalesce((p_data->>'archived')::boolean,false),coalesce(old_row.created_by,auth.uid()))
 ON CONFLICT(id) DO UPDATE SET title=excluded.title,period=excluded.period,amount=excluded.amount,
 due_date=excluded.due_date,allow_partial=excluded.allow_partial,archived=excluded.archived
 RETURNING * INTO out_row;
 INSERT INTO public.owner_audit(actor_id,tenant_id,resource,action,record_id,before_data,after_data)
 VALUES(auth.uid(),tid,'spp_invoices',CASE WHEN old_row.id IS NULL THEN 'create' ELSE 'update' END,ident,to_jsonb(old_row),to_jsonb(out_row));
 RETURN to_jsonb(out_row);
END; $$;
REVOKE ALL ON FUNCTION public.owner_invoice_action(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_invoice_action(text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_qris_action(p_kind text,p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE tid uuid; old_data jsonb; result jsonb; merchant text;
BEGIN
 IF NOT public.is_platform_developer() THEN RAISE EXCEPTION 'Akses Developer diperlukan'; END IF;
 tid:=(p_data->>'tenant_id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=tid) THEN RAISE EXCEPTION 'Instansi tidak ditemukan'; END IF;
 IF p_kind='qris' THEN
  merchant:=public.spp_qris_static(btrim(p_data->>'payload'));
  SELECT to_jsonb(s) INTO old_data FROM public.spp_qris_settings s WHERE tenant_id=tid;
  INSERT INTO public.spp_qris_settings(tenant_id,payload,merchant_name,enabled,nominal_enabled,contact_phone,created_by)
  VALUES(tid,btrim(p_data->>'payload'),merchant,coalesce((p_data->>'enabled')::boolean,false),
    coalesce((p_data->>'nominal_enabled')::boolean,false),left(coalesce(p_data->>'contact_phone',''),40),auth.uid())
  ON CONFLICT(tenant_id) DO UPDATE SET payload=excluded.payload,merchant_name=excluded.merchant_name,
    enabled=excluded.enabled,nominal_enabled=excluded.nominal_enabled,contact_phone=excluded.contact_phone,updated_at=now()
  RETURNING to_jsonb(spp_qris_settings.*) INTO result;
 ELSIF p_kind='gateway' THEN
  IF length(btrim(coalesce(p_data->>'external_store_id',''))) NOT BETWEEN 1 AND 64
  THEN RAISE EXCEPTION 'External Store ID tidak valid'; END IF;
  SELECT to_jsonb(s) INTO old_data FROM public.spp_gateway_settings s WHERE tenant_id=tid;
  INSERT INTO public.spp_gateway_settings(tenant_id,enabled,external_store_id,contact_phone,created_by)
  VALUES(tid,coalesce((p_data->>'enabled')::boolean,false),btrim(p_data->>'external_store_id'),
    left(coalesce(p_data->>'contact_phone',''),40),auth.uid())
  ON CONFLICT(tenant_id) DO UPDATE SET enabled=excluded.enabled,external_store_id=excluded.external_store_id,
    contact_phone=excluded.contact_phone,updated_at=now()
  RETURNING to_jsonb(spp_gateway_settings.*) INTO result;
 ELSE RAISE EXCEPTION 'Jenis pengaturan tidak dikenali'; END IF;
 INSERT INTO public.owner_audit(actor_id,tenant_id,resource,action,record_id,before_data,after_data)
 VALUES(auth.uid(),tid,p_kind,'update',tid,old_data,result);
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.owner_qris_action(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_qris_action(text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_payment_reconcile(p_id uuid,p_status text,p_note text,p_bank_reference text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_row public.spp_payments; new_row public.spp_payments; used bigint; invoice_amount integer;
BEGIN
 IF NOT public.is_platform_developer() THEN RAISE EXCEPTION 'Akses Developer diperlukan'; END IF;
 IF p_status NOT IN ('matched','disputed') OR length(btrim(coalesce(p_note,''))) NOT BETWEEN 4 AND 500
 THEN RAISE EXCEPTION 'Hasil dan catatan pemeriksaan wajib diisi'; END IF;
 -- Lock in the same order as spp_action: per-tenant advisory lock BEFORE row lock.
 SELECT tenant_id INTO old_row.tenant_id FROM public.spp_payments WHERE id=p_id;
 IF old_row.tenant_id IS NULL THEN RAISE EXCEPTION 'Transaksi tidak ditemukan'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(old_row.tenant_id::text,0));
 SELECT * INTO old_row FROM public.spp_payments WHERE id=p_id FOR UPDATE;
 IF old_row.id IS NULL OR old_row.provider<>'manual_qris' OR old_row.status<>'reported'
 THEN RAISE EXCEPTION 'Hanya laporan QRIS manual berstatus Dilaporkan yang boleh diverifikasi'; END IF;
 IF p_status='matched' THEN
   IF coalesce(old_row.proof_path,'')='' OR NOT EXISTS(
     SELECT 1 FROM storage.objects o WHERE o.bucket_id='spp-proofs' AND o.name=old_row.proof_path
   ) THEN RAISE EXCEPTION 'Bukti pembayaran di Storage wajib tersedia sebelum verifikasi'; END IF;
   SELECT amount INTO invoice_amount FROM public.spp_invoices WHERE id=old_row.invoice_id;
   SELECT coalesce(sum(amount),0) INTO used FROM public.spp_payments
    WHERE invoice_id=old_row.invoice_id AND id<>p_id AND status IN ('reported','matched');
   IF invoice_amount IS NULL OR used+old_row.amount>invoice_amount THEN
     RAISE EXCEPTION 'Total pembayaran melebihi tagihan; tinjau laporan lain terlebih dahulu'; END IF;
 END IF;
 IF p_status='matched' AND length(btrim(coalesce(p_bank_reference,''))) NOT BETWEEN 1 AND 160
 THEN RAISE EXCEPTION 'Nomor mutasi bank wajib diisi'; END IF;
 UPDATE public.spp_payments SET status=p_status,reviewed_by=auth.uid(),reviewed_at=now(),
 review_note=btrim(p_note),bank_reference=CASE WHEN p_status='matched' THEN btrim(p_bank_reference) ELSE NULL END
 WHERE id=p_id RETURNING * INTO new_row;
 INSERT INTO public.spp_audit(tenant_id,actor_id,action,record_id,before_data,after_data)
 VALUES(old_row.tenant_id,auth.uid(),'owner_reconcile',p_id,to_jsonb(old_row),to_jsonb(new_row));
 INSERT INTO public.owner_audit(actor_id,tenant_id,resource,action,record_id,before_data,after_data)
 VALUES(auth.uid(),old_row.tenant_id,'spp_payments','reconcile',p_id,to_jsonb(old_row),to_jsonb(new_row));
 RETURN to_jsonb(new_row);
END; $$;
REVOKE ALL ON FUNCTION public.owner_payment_reconcile(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_payment_reconcile(uuid,text,text,text) TO authenticated;

-- Wrap existing, tested tenant and pricing RPCs so Developer actions receive an audit trail.
CREATE OR REPLACE FUNCTION public.owner_save_tenant(p_tenant jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_row public.tenants; new_row public.tenants; tid uuid;
BEGIN
 IF NOT public.is_platform_developer() THEN RAISE EXCEPTION 'Akses Developer diperlukan'; END IF;
 tid:=(p_tenant->>'id')::uuid;
 IF tid IS NULL THEN RAISE EXCEPTION 'ID instansi diperlukan'; END IF;
 SELECT * INTO old_row FROM public.tenants WHERE id=tid FOR UPDATE;
 PERFORM public.save_tenant(p_tenant);
 SELECT * INTO new_row FROM public.tenants WHERE id=tid;
 INSERT INTO public.owner_audit(actor_id,tenant_id,resource,action,record_id,before_data,after_data)
 VALUES(auth.uid(),tid,'tenants',CASE WHEN old_row.id IS NULL THEN 'create' ELSE 'update' END,tid,to_jsonb(old_row),to_jsonb(new_row));
 RETURN to_jsonb(new_row);
END; $$;
REVOKE ALL ON FUNCTION public.owner_save_tenant(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_save_tenant(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_price_action(p_data jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_data jsonb; new_data jsonb; setting_id uuid:='00000000-0000-4000-8000-000000000001';
BEGIN
 IF NOT public.is_platform_developer() THEN RAISE EXCEPTION 'Akses Developer diperlukan'; END IF;
 SELECT to_jsonb(s) INTO old_data FROM public.subscription_settings s WHERE id=setting_id;
 new_data:=public.subscription_action('settings',p_data);
 INSERT INTO public.owner_audit(actor_id,resource,action,record_id,before_data,after_data)
 VALUES(auth.uid(),'subscription_settings','update',setting_id,old_data,new_data);
 RETURN new_data;
END; $$;
REVOKE ALL ON FUNCTION public.owner_price_action(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_price_action(jsonb) TO authenticated;

-- Empty-tenant deletion only. The audit record keeps the original identifier even after deletion.
CREATE OR REPLACE FUNCTION public.owner_delete_tenant(p_id uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_row public.tenants;
BEGIN
 IF NOT public.is_platform_developer() THEN RAISE EXCEPTION 'Akses Developer diperlukan'; END IF;
 SELECT * INTO old_row FROM public.tenants WHERE id=p_id FOR UPDATE;
 IF old_row.id IS NULL THEN RAISE EXCEPTION 'Instansi tidak ditemukan'; END IF;
 IF EXISTS(SELECT 1 FROM public.profiles WHERE tenant_id=p_id)
 OR EXISTS(SELECT 1 FROM public.learning_entities WHERE tenant_id=p_id)
 OR EXISTS(SELECT 1 FROM public.spp_invoices WHERE tenant_id=p_id)
 OR EXISTS(SELECT 1 FROM public.spp_payments WHERE tenant_id=p_id)
 OR EXISTS(SELECT 1 FROM public.spp_audit WHERE tenant_id=p_id)
 OR EXISTS(SELECT 1 FROM public.subscription_orders WHERE tenant_id=p_id)
 OR EXISTS(SELECT 1 FROM public.student_qr_tickets WHERE tenant_id=p_id)
 THEN RAISE EXCEPTION 'Instansi masih mempunyai data / riwayat. Tangguhkan agar riwayat tetap terjaga'; END IF;
 DELETE FROM public.spp_qris_settings WHERE tenant_id=p_id;
 DELETE FROM public.spp_gateway_settings WHERE tenant_id=p_id;
 INSERT INTO public.owner_audit(actor_id,resource,action,record_id,before_data)
 VALUES(auth.uid(),'tenants','delete',p_id,to_jsonb(old_row));
 DELETE FROM public.tenants WHERE id=p_id;
 RETURN jsonb_build_object('deleted',true,'id',p_id);
END; $$;
REVOKE ALL ON FUNCTION public.owner_delete_tenant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_delete_tenant(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
