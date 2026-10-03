import Link from "next/link";
import {
  Download,
  Activity,
  CreditCard,
  LockKeyhole,
  Wallet,
} from "lucide-react";
import { PriceForm } from "@/components/forms";
import {
  Empty,
  FilterBar,
  PageHead,
  Pager,
  Pill,
  Surface,
  TenantSelect,
} from "@/components/ui";
import { adminClient, requireDeveloper, validateUUID } from "@/lib/supabase";
import { allTenants } from "@/lib/queries";
import { datetime, rupiah, shortId } from "@/lib/format";
import type { SubscriptionOrder } from "@/lib/types";
const states = [
  "pending",
  "paid",
  "failed",
  "expired",
  "cancelled",
  "refunded",
];
const stateText: Record<string, string> = {
  pending: "Menunggu",
  paid: "Lunas",
  failed: "Gagal",
  expired: "Kedaluwarsa",
  cancelled: "Dibatalkan",
  refunded: "Dikembalikan",
};
export default async function Subscriptions({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; status?: string; page?: string }>;
}) {
  await requireDeveloper();
  const sp = await searchParams;
  const tenant = validateUUID(sp.tenant || "") ? sp.tenant : "";
  const status = states.includes(sp.status || "") ? sp.status : "";
  const page = Math.max(1, Math.min(10000, Number(sp.page) || 1)),
    size = 20;
  const db = adminClient();
  const tenants = await allTenants();
  const names = Object.fromEntries(tenants.map((t) => [t.id, t.name]));
  let q = db
    .from("subscription_orders")
    .select(
      "id,tenant_id,buyer_id,plan,amount,status,gateway,gateway_env,gateway_reference,created_at,paid_at,expires_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * size, page * size - 1);
  if (tenant) q = q.eq("tenant_id", tenant);
  if (status) q = q.eq("status", status);
  const [ordersResult, settingResult, webhookResult] = await Promise.all([
    q,
    db
      .from("subscription_settings")
      .select("monthly_price,annual_price,updated_at")
      .limit(1)
      .maybeSingle(),
    db
      .from("subscription_webhook_events")
      .select("id,order_id,gateway,gateway_env,signature_valid,created_at")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);
  for (const r of [ordersResult, settingResult, webhookResult])
    if (r.error) throw new Error(r.error.message);
  const orders = (ordersResult.data || []) as SubscriptionOrder[];
  const settings = settingResult.data;
  return (
    <>
      <PageHead
        overline="REVENUE MANAGEMENT"
        title="Langganan aplikasi"
        description="Tentukan harga paket bulanan/tahunan dan pantau pembayaran semua instansi tanpa memanipulasi transaksi gateway."
      />
      <div className="export-bar">
        <Link
          className="button secondary small"
          href={
            "/api/export/langganan?" +
            new URLSearchParams({
              ...(tenant ? { tenant } : {}),
              ...(status ? { status } : {}),
            }).toString()
          }
        >
          <Download size={16} /> Ekspor CSV
        </Link>
      </div>
      <div className="subscription-intro">
        <div className="subscription-mark">
          <Wallet size={29} />
        </div>
        <div>
          <span>PENGATURAN HARGA PLATFORM</span>
          <h2>Kelola harga langganan</h2>
          <p>
            Harga ini dibaca oleh aplikasi Flutter melalui tabel
            subscription_settings.
          </p>
        </div>
      </div>
      <section className="surface">
        <div className="surface-heading">
          <div>
            <h2>Harga paket aktif</h2>
            <p>
              Perubahan ditulis menggunakan RPC subscription_action yang
              tersedia dalam SQL.
            </p>
          </div>
          <Pill text="Khusus Developer" tone="info" />
        </div>
        <div className="pricing-content">
          <div className="price-preview">
            <div>
              <p>BULANAN</p>
              <strong>
                {settings ? rupiah(settings.monthly_price) : "Belum diatur"}
              </strong>
              <span>per bulan</span>
            </div>
            <div>
              <p>TAHUNAN</p>
              <strong>
                {settings ? rupiah(settings.annual_price) : "Belum diatur"}
              </strong>
              <span>per tahun</span>
            </div>
          </div>
          <PriceForm
            monthly={settings?.monthly_price || 1000}
            annual={settings?.annual_price || 12000}
          />
        </div>
      </section>
      <section className="surface">
        <div className="surface-heading">
          <div>
            <h2>Riwayat transaksi langganan</h2>
            <p>Status pembayaran ditentukan oleh gateway resmi dan webhook.</p>
          </div>
          <span className="surface-count">
            <Activity size={16} />
            {ordersResult.count || 0} transaksi
          </span>
        </div>
        <div className="surface-pad">
          <FilterBar action="/langganan" hideSearch>
            <TenantSelect value={tenant} tenants={tenants} />
            <select name="status" defaultValue={status}>
              <option value="">Semua status</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {stateText[s]}
                </option>
              ))}
            </select>
          </FilterBar>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>TRANSAKSI</th>
                <th>INSTANSI</th>
                <th>PAKET</th>
                <th>NOMINAL</th>
                <th>STATUS</th>
                <th>TANGGAL</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((row) => (
                <tr key={row.id}>
                  <td>
                    <b className="mono">{shortId(row.id)}</b>
                    <span className="subline">
                      {row.gateway} · {row.gateway_env}
                    </span>
                  </td>
                  <td className="cell-muted">{names[row.tenant_id] || "—"}</td>
                  <td>
                    <span className="simple-tag">
                      {row.plan === "monthly" ? "Bulanan" : "Tahunan"}
                    </span>
                  </td>
                  <td>
                    <strong>{rupiah(row.amount)}</strong>
                  </td>
                  <td>
                    <Pill
                      text={stateText[row.status] || row.status}
                      tone={
                        row.status === "paid"
                          ? "success"
                          : row.status === "pending"
                            ? "warning"
                            : row.status === "failed"
                              ? "danger"
                              : "neutral"
                      }
                    />
                  </td>
                  <td className="cell-muted">
                    {datetime(row.paid_at || row.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!orders.length && <Empty text="Belum ada transaksi langganan." />}
        </div>
        <Pager
          base="/langganan"
          page={page}
          count={ordersResult.count || 0}
          pageSize={size}
          filters={{ tenant, status }}
        />
      </section>
      <Surface
        title="Webhook gateway terbaru"
        subtitle="Metadata notifikasi pembayaran, tanpa menampilkan payload rahasia."
      >
        {webhookResult.data?.length ? (
          <div className="list-pad">
            {webhookResult.data.map((event) => (
              <div className="inline-record" key={event.id}>
                <span className="inline-icon">
                  <Activity size={18} />
                </span>
                <div>
                  <b>
                    {event.gateway} · {event.gateway_env}
                  </b>
                  <span>
                    {event.order_id
                      ? "Order " + shortId(event.order_id)
                      : "Tanpa order"}{" "}
                    · {datetime(event.created_at)}
                  </span>
                </div>
                <Pill
                  text={
                    event.signature_valid
                      ? "Signature valid"
                      : "Belum terverifikasi"
                  }
                  tone={event.signature_valid ? "success" : "warning"}
                />
              </div>
            ))}
          </div>
        ) : (
          <Empty text="Belum ada event webhook langganan." />
        )}
      </Surface>
    </>
  );
}
