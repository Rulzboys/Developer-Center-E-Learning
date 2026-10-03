"use client";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { initialAction, type Tenant } from "@/lib/types";
import { saveOwnerQrisAction } from "@/app/owner-actions";

type Qris = {
  tenant_id: string;
  payload: string;
  enabled: boolean;
  nominal_enabled: boolean;
  contact_phone: string;
  merchant_name: string;
};
type Gateway = {
  tenant_id: string;
  enabled: boolean;
  external_store_id: string;
  contact_phone: string;
};
type Mode = "qris" | "gateway";

/* ---------- Helpers: parsing & validasi payload QRIS (EMVCo) ---------- */

function crc16(str: string) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function parseTlv(data: string) {
  const out: Record<string, string> = {};
  let i = 0;
  while (i + 4 <= data.length) {
    const tag = data.slice(i, i + 2);
    const len = parseInt(data.slice(i + 2, i + 4), 10);
    if (Number.isNaN(len) || i + 4 + len > data.length) return null;
    out[tag] = data.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return i === data.length ? out : null;
}

type PayloadInfo =
  | { state: "empty" }
  | { state: "invalid"; reason: string }
  | { state: "valid"; merchant: string; city: string; dynamic: boolean };

function inspectPayload(raw: string): PayloadInfo {
  const p = raw.trim();
  if (!p) return { state: "empty" };
  if (!p.startsWith("000201"))
    return {
      state: "invalid",
      reason: "Payload harus diawali 000201 (format QRIS).",
    };
  if (p.length < 20 || p.slice(-8, -4) !== "6304")
    return {
      state: "invalid",
      reason: "Payload tidak lengkap (CRC di akhir tidak ditemukan).",
    };
  if (crc16(p.slice(0, -4)) !== p.slice(-4).toUpperCase())
    return {
      state: "invalid",
      reason: "CRC tidak cocok. Payload kemungkinan terpotong atau rusak.",
    };
  const tlv = parseTlv(p);
  if (!tlv)
    return { state: "invalid", reason: "Struktur payload tidak bisa dibaca." };
  return {
    state: "valid",
    merchant: tlv["59"] || "-",
    city: tlv["60"] || "-",
    dynamic: tlv["01"] === "12",
  };
}

/* ---------- Helpers: decode gambar QR di browser ---------- */

const MAX_FILE = 5 * 1024 * 1024;

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gambar tidak bisa dibuka."));
    img.src = url;
  });
}

async function decodeQrFromFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/"))
    throw new Error("File harus berupa gambar (PNG/JPG/WebP).");
  if (file.size > MAX_FILE) throw new Error("Ukuran gambar maksimal 5 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    for (const cap of [1600, 1000, 600]) {
      const scale = Math.min(1, cap / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) continue;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const res = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, {
        inversionAttempts: "attemptBoth",
      });
      if (res?.data) return res.data.trim();
    }
    throw new Error(
      "QR tidak terbaca. Gunakan gambar yang jelas dan tidak terpotong, atau tempel payload secara manual.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ---------- Komponen utama ---------- */

export default function QrisForms({
  tenants,
  qris,
  gateway,
  defaultTenant,
}: {
  tenants: Tenant[];
  qris: Qris[];
  gateway: Gateway[];
  defaultTenant: string;
}) {
  const [tenant, setTenant] = useState(defaultTenant || tenants[0]?.id || "");
  const [mode, setMode] = useState<Mode>("qris");
  const manual = qris.find((x) => x.tenant_id === tenant);
  const gw = gateway.find((x) => x.tenant_id === tenant);
  const selected = tenants.find((t) => t.id === tenant);

  return (
    <section className="surface qf">
      <style>{css}</style>

      <div className="surface-heading">
        <div>
          <h2>Konfigurasi pembayaran per instansi</h2>
          <p>
            QRIS manual dan gateway disimpan langsung pada tabel yang digunakan
            Flutter.
          </p>
        </div>
        {tenant && (
          <span
            className={
              "pill " +
              ((mode === "qris" ? manual?.enabled : gw?.enabled)
                ? "success"
                : "neutral")
            }
          >
            <span className="pill-dot" />
            {(mode === "qris" ? manual?.enabled : gw?.enabled)
              ? "Aktif"
              : "Belum aktif"}
          </span>
        )}
      </div>

      <div className="qf-toolbar">
        <label className="field">
          Instansi
          <select value={tenant} onChange={(e) => setTenant(e.target.value)}>
            <option value="">Pilih instansi</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          Metode pembayaran
          <div className="qf-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "qris"}
              className={mode === "qris" ? "active" : ""}
              onClick={() => setMode("qris")}
            >
              QRIS Manual
            </button>
          </div>
        </div>
      </div>

      {tenant ? (
        <ConfigForm
          key={tenant + "-" + mode}
          tenant={tenant}
          tenantName={selected?.name || ""}
          mode={mode}
          manual={manual}
          gw={gw}
        />
      ) : (
        <div className="empty">
          <div className="empty-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20v1" />
            </svg>
          </div>
          <b>Pilih instansi</b>
          <p>Pilih instansi di atas untuk mulai mengatur pembayaran.</p>
        </div>
      )}
    </section>
  );
}

function ConfigForm({
  tenant,
  tenantName,
  mode,
  manual,
  gw,
}: {
  tenant: string;
  tenantName: string;
  mode: Mode;
  manual?: Qris;
  gw?: Gateway;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    saveOwnerQrisAction,
    initialAction,
  );
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  const [payload, setPayload] = useState(manual?.payload || "");
  const [enabled, setEnabled] = useState(
    (mode === "qris" ? manual?.enabled : gw?.enabled) ?? false,
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const info = useMemo(() => inspectPayload(payload), [payload]);
  const changed = payload.trim() !== (manual?.payload || "").trim();

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFile = useCallback(async (file?: File | null) => {
    if (!file) return;
    setScanError("");
    setScanning(true);
    try {
      const data = await decodeQrFromFile(file);
      setPayload(data);
      setFileName(file.name);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(file);
      });
    } catch (e) {
      setScanError(e instanceof Error ? e.message : "Gagal membaca gambar.");
    } finally {
      setScanning(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, []);

  // Tempel gambar (Ctrl+V) saat mode QRIS
  useEffect(() => {
    if (mode !== "qris") return;
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items || []).find((i) =>
        i.type.startsWith("image/"),
      );
      const f = item?.getAsFile();
      if (f) {
        e.preventDefault();
        handleFile(f);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [mode, handleFile]);

  const blocked = mode === "qris" && info.state !== "valid";

  return (
    <form action={action} className="qf-form">
      <input type="hidden" name="tenant_id" value={tenant} />
      <input type="hidden" name="kind" value={mode} />
      <input type="hidden" name="enabled" value={enabled ? "true" : "false"} />

      {mode === "qris" ? (
        <>
          <div className="qf-grid">
            {/* Kiri: upload */}
            <div className="qf-card">
              <div className="qf-card-title">Upload gambar QRIS</div>
              <div
                className={"qf-drop" + (dragging ? " drag" : "")}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  handleFile(e.dataTransfer.files?.[0]);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }}
              >
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview}
                    alt="Preview QRIS"
                    className="qf-preview"
                  />
                ) : (
                  <div className="qf-drop-hint">
                    <span className="qf-drop-icon">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M12 16V4m0 0l-4 4m4-4l4 4" />
                        <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
                      </svg>
                    </span>
                    <b>
                      {scanning
                        ? "Membaca QR…"
                        : "Klik, seret, atau tempel gambar"}
                    </b>
                    <span className="muted text-small">
                      PNG, JPG, atau WebP · maks. 5 MB
                    </span>
                  </div>
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              {preview && (
                <div className="qf-file">
                  <span title={fileName}>{fileName}</span>
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                  >
                    Ganti gambar
                  </button>
                </div>
              )}
              {scanError && <p className="form-alert error">{scanError}</p>}
              {!scanError && preview && info.state === "valid" && (
                <p className="form-alert ok">
                  QR berhasil dibaca. Payload terisi otomatis.
                </p>
              )}
            </div>

            {/* Kanan: info merchant */}
            <div className="qf-card">
              <div className="qf-card-title">Informasi merchant</div>
              <dl className="qf-info">
                <div>
                  <dt>Tersimpan saat ini</dt>
                  <dd>{manual?.merchant_name || "Belum dikonfigurasi"}</dd>
                </div>
                <div>
                  <dt>Terbaca dari payload</dt>
                  <dd>{info.state === "valid" ? info.merchant : "-"}</dd>
                </div>
                <div>
                  <dt>Kota</dt>
                  <dd>{info.state === "valid" ? info.city : "-"}</dd>
                </div>
                <div>
                  <dt>Tipe QRIS</dt>
                  <dd>
                    {info.state === "valid"
                      ? info.dynamic
                        ? "Dinamis"
                        : "Statis"
                      : "-"}
                  </dd>
                </div>
                <div>
                  <dt>Validasi</dt>
                  <dd>
                    {info.state === "valid" && (
                      <span className="pill success">
                        <span className="pill-dot" />
                        CRC valid
                      </span>
                    )}
                    {info.state === "invalid" && (
                      <span className="pill danger">
                        <span className="pill-dot" />
                        Tidak valid
                      </span>
                    )}
                    {info.state === "empty" && (
                      <span className="pill neutral">
                        <span className="pill-dot" />
                        Belum ada payload
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
              {info.state === "invalid" && (
                <p className="form-alert error">{info.reason}</p>
              )}
              {changed && info.state === "valid" && (
                <p className="qf-warn">
                  Payload berbeda dari yang tersimpan
                  {tenantName ? ` untuk ${tenantName}` : ""}. Klik simpan untuk
                  menerapkan.
                </p>
              )}
            </div>
          </div>

          <label className="field">
            <span className="qf-row">
              Payload QRIS statis
              <small className="muted">{payload.length}/2048</small>
            </span>
            <textarea
              required
              name="payload"
              rows={4}
              maxLength={2048}
              spellCheck={false}
              value={payload}
              onChange={(e) =>
                setPayload(e.target.value.replace(/[\r\n]+/g, "").trim())
              }
              placeholder="Otomatis terisi dari upload, atau tempel payload QRIS merchant yang sah"
            />
            <span className="helper">
              Payload dibaca dari QR pada gambar. Anda tetap bisa mengedit atau
              menempel manual.
            </span>
          </label>

          <div className="qf-grid">
            <label className="field">
              Nominal otomatis
              <select
                defaultValue={manual?.nominal_enabled ? "true" : "false"}
                name="nominal_enabled"
              >
                <option value="false">Tidak</option>
                <option value="true">Ya (jika didukung penyedia)</option>
              </select>
            </label>
            <ContactField defaultValue={manual?.contact_phone || ""} />
          </div>

          <label className="qf-check">
            <input type="checkbox" name="consent" value="yes" required />
            <span>
              Saya berwenang mengelola QRIS merchant dan sudah memastikan fitur
              nominal didukung.
            </span>
          </label>
        </>
      ) : (
        <div className="qf-grid">
          <label className="field">
            DANA External Store ID
            <input
              required
              name="external_store_id"
              maxLength={64}
              defaultValue={gw?.external_store_id || ""}
            />
          </label>
          <ContactField defaultValue={gw?.contact_phone || ""} />
        </div>
      )}

      <div className="qf-status">
        <div>
          <b>Status metode ini</b>
          <span>
            {enabled
              ? "Aktif: metode ini tampil di aplikasi mobile."
              : "Nonaktif: metode ini disembunyikan dari aplikasi mobile."}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Aktifkan metode pembayaran"
          className={"qf-switch" + (enabled ? " on" : "")}
          onClick={() => setEnabled((v) => !v)}
        >
          <i />
        </button>
      </div>

      {state.message && (
        <p
          className={"form-alert " + (state.ok ? "ok" : "error")}
          role="status"
        >
          {state.message}
        </p>
      )}

      <div className="qf-actions">
        {blocked && (
          <span className="helper">
            Tombol simpan aktif setelah payload QRIS valid.
          </span>
        )}
        <button
          className="button primary"
          disabled={pending || blocked}
          type="submit"
        >
          {pending ? "Menyimpan…" : "Simpan konfigurasi"}
        </button>
      </div>
    </form>
  );
}

function ContactField({ defaultValue }: { defaultValue: string }) {
  return (
    <label className="field">
      Kontak pembayaran
      <input
        name="contact_phone"
        maxLength={40}
        defaultValue={defaultValue}
        placeholder="Contoh: 08123456789"
      />
    </label>
  );
}

/* ---------- Styling (scoped .qf, memakai variabel tema globals.css) ---------- */

const css = `
.qf .qf-toolbar{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px;padding:21px 23px;border-bottom:1px solid #eff2f6;background:#fafbfd}
.qf .qf-form{display:flex;flex-direction:column;gap:20px;padding:23px}
.qf .qf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px}
.qf .field textarea{width:100%;min-height:104px;resize:vertical;border:1px solid #dfe5f0;background:#fff;border-radius:9px;padding:13px 14px;outline:none;color:#25324a;font-weight:500;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;line-height:1.65;word-break:break-all}
.qf .field textarea:focus{border-color:#6886ed;box-shadow:0 0 0 3px #edf1ff}
.qf .field textarea::placeholder{color:#aeb9c9;font-family:'DM Sans',Inter,ui-sans-serif,system-ui,sans-serif}
.qf .qf-row{display:flex;justify-content:space-between;align-items:center;gap:10px}
.qf .qf-row small{font-weight:500;font-size:10.5px}
.qf .qf-tabs{display:inline-flex;gap:4px;padding:4px;border-radius:11px;background:#eef1f7;align-self:flex-start;height:46px;align-items:stretch}
.qf .qf-tabs button{border:0;background:transparent;padding:0 17px;border-radius:8px;font-weight:700;font-size:12px;color:#7a889e;transition:background .15s,color .15s,box-shadow .15s}
.qf .qf-tabs button:hover{color:var(--ink)}
.qf .qf-tabs button.active{background:#fff;color:var(--blue);box-shadow:0 2px 8px rgba(20,40,77,.09)}
.qf .qf-card{border:1px solid var(--border);border-radius:12px;padding:19px;display:flex;flex-direction:column;gap:14px;min-width:0;background:#fff}
.qf .qf-card-title{font-weight:800;font-size:13px;letter-spacing:-.02em;color:#253148}
.qf .qf-drop{border:1.5px dashed #c8d5eb;background:#f6f9ff;border-radius:12px;min-height:190px;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:16px;text-align:center;transition:border-color .15s,background .15s}
.qf .qf-drop:hover,.qf .qf-drop.drag,.qf .qf-drop:focus-visible{border-color:var(--blue);background:var(--blue-soft);outline:none}
.qf .qf-drop-hint{display:flex;flex-direction:column;align-items:center;gap:7px}
.qf .qf-drop-hint b{font-size:12.5px;color:#34486a}
.qf .qf-drop-icon{display:grid;place-items:center;width:46px;height:46px;border-radius:12px;background:#e9eeff;color:var(--blue);margin-bottom:3px}
.qf .qf-preview{max-width:100%;max-height:260px;border-radius:9px;object-fit:contain;background:#fff;padding:6px;border:1px solid var(--border)}
.qf .qf-file{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:11px}
.qf .qf-file span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)}
.qf .qf-file button{border:0;background:transparent;color:var(--blue);font-weight:800;font-size:11px;padding:0;white-space:nowrap}
.qf .qf-file button:hover{text-decoration:underline}
.qf .qf-info{display:flex;flex-direction:column}
.qf .qf-info>div{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid #f0f2f6}
.qf .qf-info>div:first-child{padding-top:2px}
.qf .qf-info>div:last-child{border-bottom:0;padding-bottom:0}
.qf .qf-info dt{color:#909eb1;font-size:11px;white-space:nowrap}
.qf .qf-info dd{font-weight:700;font-size:11.5px;text-align:right;overflow-wrap:anywhere;color:#253148}
.qf .qf-warn{margin:0;font-size:11px;line-height:1.6;color:#b07a1a;background:#fff4e2;border:1px solid #f7e2bb;border-radius:9px;padding:11px 13px}
.qf .qf-check{display:flex;gap:11px;align-items:flex-start;font-size:11.5px;line-height:1.65;color:#51627c;padding:14px 16px;border-radius:10px;background:#f6f9ff;border:1px solid #e2e9f4;cursor:pointer}
.qf .qf-check input{margin-top:3px;width:15px;height:15px;accent-color:var(--blue);flex:none}
.qf .qf-status{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px 18px;border:1px solid var(--border);border-radius:12px;background:#fafbfd}
.qf .qf-status>div{display:flex;flex-direction:column;gap:5px}
.qf .qf-status b{font-size:12px;color:#253148}
.qf .qf-status span{font-size:11px;color:var(--muted);line-height:1.5}
.qf .qf-switch{width:46px;height:26px;border-radius:999px;border:0;background:#cfd6e3;position:relative;flex:none;transition:background .18s;padding:0}
.qf .qf-switch i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(20,40,77,.25);transition:transform .18s}
.qf .qf-switch.on{background:var(--teal)}
.qf .qf-switch.on i{transform:translateX(20px)}
.qf .qf-switch:focus-visible{outline:2px solid #6886ed;outline-offset:2px}
.qf .qf-actions{display:flex;justify-content:flex-end;align-items:center;gap:14px;padding-top:18px;border-top:1px solid #edf0f5}
.qf .form-alert{margin:0}
@media(max-width:760px){
  .qf .qf-toolbar,.qf .qf-grid{grid-template-columns:1fr}
  .qf .qf-toolbar{padding:17px}
  .qf .qf-form{padding:17px}
  .qf .qf-actions{flex-direction:column;align-items:stretch}
  .qf .qf-actions .button{width:100%}
  .qf .qf-tabs{width:100%}
  .qf .qf-tabs button{flex:1;padding:0 8px}
}
`;
