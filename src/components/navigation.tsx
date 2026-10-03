"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Building2,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Command,
  CreditCard,
  FileBarChart,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Megaphone,
  History,
  Search,
  Settings2,
  ShieldCheck,
  UserCog,
  Users,
  Wallet,
  X,
  LibraryBig,
  NotebookTabs,
  ChartNoAxesCombined,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { signOutAction } from "@/app/actions";
import type { Profile } from "@/lib/types";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { title: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    title: "Ringkasan",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/laporan", label: "Laporan & Analitik", icon: FileBarChart },
    ],
  },
  {
    title: "Instansi",
    items: [
      { href: "/instansi", label: "Manajemen Instansi", icon: Building2 },
      {
        href: "/tahun-akademik",
        label: "Tahun Akademik & Semester",
        icon: CalendarRange,
      },
    ],
  },
  {
    title: "Pengguna",
    items: [
      { href: "/akun", label: "Semua Akun", icon: Users },
      {
        href: "/pengguna/leader",
        label: "Manajemen Pimpinan",
        icon: ShieldCheck,
      },
      { href: "/pengguna/admin", label: "Manajemen Admin", icon: UserCog },
      { href: "/pengguna/teacher", label: "Manajemen Guru", icon: Users },
      {
        href: "/pengguna/student",
        label: "Manajemen Siswa",
        icon: GraduationCap,
      },
    ],
  },
  {
    title: "Akademik",
    items: [
      {
        href: "/akademik/classroom",
        label: "Manajemen Kelas",
        icon: Building2,
      },
      { href: "/akademik/assignment", label: "Tugas", icon: ClipboardList },
      { href: "/akademik/attendance", label: "Absensi", icon: ClipboardCheck },
      {
        href: "/akademik/material",
        label: "Materi Pembelajaran",
        icon: LibraryBig,
      },
      { href: "/akademik/memorization", label: "Hafalan", icon: BookOpen },
      {
        href: "/perkembangan",
        label: "Perkembangan Siswa",
        icon: ChartNoAxesCombined,
      },
      {
        href: "/akademik/subject",
        label: "Mata Pelajaran",
        icon: NotebookTabs,
      },
      { href: "/akademik/schedule", label: "Jadwal", icon: CalendarRange },
      {
        href: "/akademik/submission",
        label: "Pengumpulan Tugas",
        icon: ClipboardList,
      },
    ],
  },
  {
    title: "Komunikasi",
    items: [
      {
        href: "/akademik/announcement",
        label: "Pengumuman & Notifikasi",
        icon: Megaphone,
      },
    ],
  },
  {
    title: "Keuangan",
    items: [
      { href: "/spp", label: "SPP & Pembayaran", icon: Wallet },
      { href: "/qris", label: "Pengaturan QRIS", icon: CreditCard },
      { href: "/langganan", label: "Langganan & Harga", icon: FileBarChart },
    ],
  },
  {
    title: "Sistem",
    items: [
      {
        href: "/kontrol-aplikasi",
        label: "Kontrol Aplikasi",
        icon: Settings2,
      },
      { href: "/riwayat", label: "Audit Developer", icon: History },
      { href: "/pengaturan", label: "Profil Developer", icon: UserCog },
    ],
  },
];
const allPages: NavItem[] = groups.flatMap((g) => g.items);
const SIDEBAR_KEY = "sidebar-closed";

function SideContent({
  profile,
  close,
}: {
  profile: Profile;
  close?: () => void;
}) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState<string[]>([]);
  return (
    <>
      <div className="sidebar-top">
        <Link href="/dashboard" className="sidebar-brand" onClick={close}>
          <span className="sidebar-brand-icon">
            <BookOpen size={21} />
          </span>
          <span>
            E-Learning<small>Developer Panel</small>
          </span>
        </Link>
      </div>
      <nav aria-label="Navigasi developer" className="sidebar-nav">
        {groups.map((group) => {
          const hidden = collapsed.includes(group.title);
          return (
            <div className="nav-group" key={group.title}>
              <button
                className="nav-group-title"
                type="button"
                aria-expanded={!hidden}
                onClick={() =>
                  setCollapsed((old) =>
                    hidden
                      ? old.filter((x) => x !== group.title)
                      : [...old, group.title],
                  )
                }
              >
                <span>{group.title}</span>
                <ChevronDown className={hidden ? "rotated" : ""} size={14} />
              </button>
              {!hidden &&
                group.items.map((item) => {
                  const active =
                    path === item.href || path.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <Link
                      className={"nav-link " + (active ? "active" : "")}
                      href={item.href}
                      key={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={close}
                    >
                      <Icon size={17} strokeWidth={1.8} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
            </div>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-user">
          <span className="avatar">
            {profile.name?.[0]?.toUpperCase() || "D"}
          </span>
          <div className="sidebar-user-name">
            <b>{profile.name}</b>
            <span>{profile.email}</span>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="icon-btn logout-btn"
              aria-label="Keluar"
            >
              <LogOut size={17} />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
export function Sidebar({ profile }: { profile: Profile }) {
  return (
    <aside className="sidebar">
      <SideContent profile={profile} />
    </aside>
  );
}
export function ConsoleHeader({ profile }: { profile: Profile }) {
  const path = usePathname(),
    router = useRouter();
  const [drawer, setDrawer] = useState(false),
    [search, setSearch] = useState(false),
    [query, setQuery] = useState(""),
    [closed, setClosed] = useState(false);

  // Baca status sidebar yang tersimpan
  useEffect(() => {
    try {
      const v = localStorage.getItem(SIDEBAR_KEY) === "1";
      setClosed(v);
      document.documentElement.dataset.sidebar = v ? "closed" : "open";
    } catch {
      document.documentElement.dataset.sidebar = "open";
    }
  }, []);
  function toggleSidebar() {
    const next = !closed;
    setClosed(next);
    document.documentElement.dataset.sidebar = next ? "closed" : "open";
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
    } catch {}
  }

  useEffect(() => {
    function key(event: KeyboardEvent) {
      const k = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && k === "k") {
        event.preventDefault();
        setSearch((v) => !v);
      }
      if ((event.ctrlKey || event.metaKey) && k === "b") {
        event.preventDefault();
        toggleSidebar();
      }
      if (event.key === "Escape") {
        setDrawer(false);
        setSearch(false);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [closed]);

  const page = allPages.find(
    (p) => p.href === path || path.startsWith(p.href + "/"),
  );
  const matches = allPages.filter((p) =>
    p.label.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <header className="console-topbar">
        <div className="topbar-left">
          <button
            className="mobile-menu-trigger"
            aria-label="Buka navigasi"
            type="button"
            onClick={() => setDrawer(true)}
          >
            <Menu size={22} />
          </button>
          <button
            className="desktop-sidebar-toggle"
            type="button"
            onClick={toggleSidebar}
            aria-label={closed ? "Buka sidebar" : "Tutup sidebar"}
            aria-pressed={closed}
            title={(closed ? "Buka" : "Tutup") + " sidebar (Ctrl+B)"}
          >
            {closed ? (
              <PanelLeftOpen size={20} />
            ) : (
              <PanelLeftClose size={20} />
            )}
          </button>
          <div className="topbar-breadcrumb">
            <span>Developer Panel</span>
            <ChevronRight size={14} />
            <b>{page?.label || "Dashboard"}</b>
          </div>
        </div>
        <div className="topbar-right">
          <button
            type="button"
            className="topbar-search"
            onClick={() => setSearch(true)}
          >
            <Search size={17} />
            <span>Cari menu...</span>
            <kbd>Ctrl K</kbd>
          </button>
          <span className="topbar-user-avatar" title={profile.name}>
            {profile.name[0]?.toUpperCase()}
          </span>
        </div>
      </header>
      {drawer && (
        <>
          <button
            type="button"
            aria-label="Tutup navigasi"
            className="drawer-backdrop"
            onClick={() => setDrawer(false)}
          />
          <aside className="mobile-drawer">
            <button
              className="drawer-close icon-btn"
              onClick={() => setDrawer(false)}
              aria-label="Tutup menu"
            >
              <X size={20} />
            </button>
            <SideContent profile={profile} close={() => setDrawer(false)} />
          </aside>
        </>
      )}
      {search && (
        <div
          className="command-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSearch(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Pencarian menu"
            className="command-dialog"
          >
            <div className="command-input">
              <Search size={21} />
              <input
                autoFocus
                placeholder="Cari halaman..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button onClick={() => setSearch(false)} aria-label="Tutup">
                <X size={18} />
              </button>
            </div>
            <div className="command-results">
              {matches.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    onClick={() => {
                      setSearch(false);
                      setQuery("");
                      router.push(item.href);
                    }}
                  >
                    <Icon size={18} />
                    {item.label}
                    <ChevronRight size={16} />
                  </button>
                );
              })}
              {!matches.length && <p>Menu tidak ditemukan.</p>}
            </div>
            <div className="command-foot">
              <Command size={14} /> Ctrl / ⌘ + K
            </div>
          </div>
        </div>
      )}
    </>
  );
}
