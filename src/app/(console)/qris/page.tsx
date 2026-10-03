import { PageHead } from "@/components/ui";
import { adminClient, requireDeveloper, validateUUID } from "@/lib/supabase";
import { allTenants } from "@/lib/queries";
import QrisForms from "@/components/owner/qris-form";
export default async function Qris({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  await requireDeveloper();
  const tenant = validateUUID((await searchParams).tenant || "")
    ? (await searchParams).tenant || ""
    : "";
  const [tenants, manual, gateway] = await Promise.all([
    allTenants(),
    adminClient()
      .from("spp_qris_settings")
      .select(
        "tenant_id,payload,enabled,nominal_enabled,contact_phone,merchant_name",
      )
      .limit(1500),
    adminClient()
      .from("spp_gateway_settings")
      .select("tenant_id,enabled,external_store_id,contact_phone")
      .limit(1500),
  ]);
  if (manual.error || gateway.error)
    throw new Error(manual.error?.message || gateway.error?.message);
  return (
    <>
      <PageHead
        overline="KEUANGAN / PENGATURAN"
        title="Pengaturan QRIS"
        description="Kelola merchant QRIS dan gateway untuk setiap instansi. Perubahan ini langsung memengaruhi konfigurasi pembayaran di aplikasi mobile."
      />
      <QrisForms
        tenants={tenants}
        qris={manual.data || []}
        gateway={gateway.data || []}
        defaultTenant={tenant}
      />
    </>
  );
}
