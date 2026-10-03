-- READ-ONLY inspection. Run in Supabase SQL Editor after staging migration 002.
-- SQL Editor typically runs as a privileged owner; this DOES NOT prove end-user RLS.
SELECT to_regclass('public.owner_audit') AS audit_table;
SELECT proname AS developer_function FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND proname IN (
 'is_platform_developer','owner_profile_action','owner_entity_action',
 'owner_invoice_action','owner_qris_action','owner_payment_reconcile',
 'owner_save_tenant','owner_delete_tenant','owner_price_action'
) ORDER BY proname;
SELECT tablename,policyname,cmd,roles,qual FROM pg_policies
WHERE schemaname='public' AND policyname IN (
 'owner_profiles_read','owner_learning_read','owner_invoices_read',
 'owner_payments_read','owner_qris_read','owner_gateway_read',
 'owner_spp_audit_read','owner_audit_read'
) ORDER BY tablename;
-- End-to-end checks MUST additionally use real developer and admin/student JWTs in staging.
