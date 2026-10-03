import Link from "next/link";
import {
  Download,
  CreditCard,
  FileCheck2,
  ReceiptText,
  ShieldAlert,
} from "lucide-react";
import {
  Empty,
  FilterBar,
  PageHead,
  Pager,
  Pill,
  Surface,
  TenantSelect,
} from "@/components/ui";
import { PaymentReview } from "@/components/owner/finance-editor";
import { adminClient, requireDeveloper, validateUUID } from "@/lib/supabase";
import { allTenants } from "@/lib/queries";
import { date, datetime, rupiah, shortId } from "@/lib/format";
import type { Invoice, Payment } from "@/lib/types";
export default async function SppPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; status?: string; page?: string }>;
}) {
  await requireDeveloper();
  const sp = await searchParams;
  const tenant = validateUUID(sp.tenant || "") ? sp.tenant : "";
  const status = ["pending", "reported", "matched", "disputed"].includes(
    sp.status || "",
  )
    ? sp.status
    : "";
  const page = Math.max(1, Math.min(10000, Number(sp.page) || 1)),
    size = 15;
  const db = adminClient();
  const tenants = await allTenants();
  const names = Object.fromEntries(tenants.map((t) => [t.id, t.name]));
  let p = db
    .from("spp_payments")
    .select(
      "id,tenant_id,invoice_id,student_id,amount,status,provider,created_at,paid_at,reported_at,proof_path,review_note",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * size, page * size - 1);
  let i = db
    .from("spp_invoices")
    .select(
      "id,tenant_id,student_id,title,period,amount,due_date,archived,created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .limit(8);
  let audit = db
    .from("spp_audit")
    .select("id,tenant_id,action,created_at,record_id")
    .order("created_at", { ascending: false })
    .limit(6);
  if (tenant) {
    p = p.eq("tenant_id", tenant);
    i = i.eq("tenant_id", tenant);
    audit = audit.eq("tenant_id", tenant);
  }
  if (status) p = p.eq("status", status);
  const [paymentsResult, invoicesResult, auditResult] = await Promise.all([
    p,
    i,
    audit,
  ]);
  for (const r of [paymentsResult, invoicesResult, auditResult])
    if (r.error) throw new Error(r.error.message);
  const payments = (paymentsResult.data || []) as Payment[],
    invoices = (invoicesResult.data || []) as Invoice[];
  return (
    <>
      <PageHead
        overline="KEUANGAN / MONITORING"
        title="Pembayaran SPP"
        description="Awasi tagihan dan status transaksi QRIS manual maupun DANA seluruh instansi. Developer dapat memeriksa QRIS manual; transaksi gateway hanya diubah melalui proses resmi."
      />
      <div className="export-bar">
        <Link
          className="button secondary small"
          href={
            "/api/export/spp?" +
            new URLSearchParams({
              ...(tenant ? { tenant } : {}),
              ...(status ? { status } : {}),
            }).toString()
          }
        >
          <Download size={16} /> Ekspor CSV
        </Link>
        <Link className="button primary small" href="/spp/tagihan">
          Kelola tagihan
        </Link>
      </div>
      <section className="stat-grid three">
        <div className="mini-overview">
          <span className="mini-icon teal">
            <CreditCard size={23} />
          </span>
          <div>
            <p>Transaksi sesuai filter</p>
            <strong>{paymentsResult.count || 0}</strong>
          </div>
        </div>
        <div className="mini-overview">
          <span className="mini-icon violet">
            <ReceiptText size={23} />
          </span>
          <div>
            <p>Tagihan sesuai instansi</p>
            <strong>{invoicesResult.count || 0}</strong>
          </div>
        </div>
        <div className="mini-overview">
          <span className="mini-icon orange">
            <FileCheck2 size={23} />
          </span>
          <div>
            <p>Bukti pembayaran</p>
            <strong>Privat</strong>
          </div>
        </div>
      </section>
      <section className="surface">
        <div className="surface-heading">
          <div>
            <h2>Riwayat pembayaran</h2>
            <p>
              Referensi transaksi, metode, dan status tercatat langsung dari
              Supabase.
            </p>
          </div>
          <span className="surface-count">
            <CreditCard size={16} />
            {paymentsResult.count || 0} transaksi
          </span>
        </div>
        <div className="surface-pad">
          <FilterBar action="/spp" hideSearch>
            <TenantSelect value={tenant} tenants={tenants} />
            <select name="status" defaultValue={status}>
              <option value="">Semua status</option>
              <option value="pending">Menunggu</option>
              <option value="reported">Dilaporkan</option>
              <option value="matched">Terverifikasi</option>
              <option value="disputed">Disengketakan</option>
            </select>
          </FilterBar>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>TRANSAKSI</th>
                <th>INSTANSI</th>
                <th>NOMINAL</th>
                <th>PROVIDER</th>
                <th>STATUS</th>
                <th>WAKTU</th>
                <th className="right">TINDAKAN</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((row) => (
                <tr key={row.id}>
                  <td>
                    <b className="mono">{shortId(row.id)}</b>
                    <span className="subline">
                      Siswa: {shortId(row.student_id)}
                    </span>
                  </td>
                  <td className="cell-muted">{names[row.tenant_id] || "—"}</td>
                  <td>
                    <strong>{rupiah(row.amount)}</strong>
                  </td>
                  <td>
                    <span className="simple-tag">
                      {row.provider === "dana" ? "DANA" : "QRIS manual"}
                    </span>
                  </td>
                  <td>
                    <Pill
                      text={
                        {
                          pending: "Menunggu",
                          reported: "Dilaporkan",
                          matched: "Terverifikasi",
                          disputed: "Disengketakan",
                        }[row.status] || row.status
                      }
                      tone={
                        row.status === "matched"
                          ? "success"
                          : row.status === "reported"
                            ? "info"
                            : row.status === "disputed"
                              ? "danger"
                              : "warning"
                      }
                    />
                  </td>
                  <td className="cell-muted">
                    {datetime(row.paid_at || row.reported_at || row.created_at)}
                  </td>
                  <td className="table-actions">
                    {row.provider === "manual_qris" &&
                    row.status === "reported" ? (
                      <PaymentReview payment={row} />
                    ) : (
                      <span className="cell-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!payments.length && (
            <Empty text="Belum ada transaksi pembayaran yang sesuai filter." />
          )}
        </div>
        <Pager
          base="/spp"
          page={page}
          count={paymentsResult.count || 0}
          pageSize={size}
          filters={{ tenant, status }}
        />
      </section>
      <div className="dashboard-columns">
        <Surface
          title="Tagihan terbaru"
          subtitle="8 tagihan terbaru berdasarkan filter instansi."
        >
          {invoices.length ? (
            <div className="list-pad">
              {invoices.map((inv) => (
                <div className="inline-record" key={inv.id}>
                  <span className="inline-icon">
                    <ReceiptText size={19} />
                  </span>
                  <div>
                    <b>
                      {inv.title} · {inv.period}
                    </b>
                    <span>
                      {names[inv.tenant_id] || "—"} · Jatuh tempo{" "}
                      {date(inv.due_date)}
                    </span>
                  </div>
                  <div className="inline-record-end">
                    <b>{rupiah(inv.amount)}</b>
                    <Pill
                      text={inv.archived ? "Diarsipkan" : "Aktif"}
                      tone={inv.archived ? "neutral" : "success"}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="Belum ada tagihan." />
          )}
        </Surface>
        <Surface
          title="Audit transaksi"
          subtitle="Peristiwa dari spp_audit (6 terbaru)."
        >
          {auditResult.data?.length ? (
            <div className="list-pad">
              {auditResult.data.map((a) => (
                <div className="inline-record" key={a.id}>
                  <span className="inline-icon">
                    <ShieldAlert size={17} />
                  </span>
                  <div>
                    <b>{a.action}</b>
                    <span>
                      {names[a.tenant_id] || "—"} · {shortId(a.record_id)}
                    </span>
                  </div>
                  <span className="cell-muted text-small">
                    {date(a.created_at)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="Tidak ada catatan audit SPP." />
          )}
        </Surface>
      </div>
    </>
  );
}
