// app/admin/users/page.tsx

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Trash2, Ban, ShieldOff, ChevronLeft, ChevronRight,
  RefreshCw, AlertTriangle, X, Check, Smartphone, Globe, Users,
  Minus, Eye, Wifi, WifiOff, ChevronDown, ChevronUp,
  MonitorSmartphone, Loader2, List,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Device = {
  deviceId:   string;
  userAgent:  string;
  ip:         string;
  lastSeen:   string;
  isBanned:   boolean;
  banReason?: string;
};

type User = {
  _id:         string;
  fullName:    string;
  email:       string;
  role:        "admin" | "employee";
  status:      "active" | "suspended" | "banned";
  companyName: string;
  createdAt:   string;
  lastLogin:   string | null;
  devices:     Device[];
};

type BannedDevice = {
  _id:       string;
  type:      "device" | "ip";
  value:     string;
  reason:    string;
  bannedAt:  string;
  userAgent: string;
};

type ModalType =
  | { kind: "confirmDelete"; userIds: string[] }
  | { kind: "banDevice";     userId: string; device: Device }
  | { kind: "banIp";         userId: string; device: Device }
  | { kind: "bulkBanDevices"; devices: Array<{ userId: string; device: Device }> }
  | { kind: "globalBans" }
  | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { text: string; bg: string }> = {
  active:    { text: "#22d3a0", bg: "rgba(34,211,160,0.12)"  },
  suspended: { text: "#fbbf24", bg: "rgba(251,191,36,0.12)"  },
  banned:    { text: "#f87171", bg: "rgba(248,113,113,0.12)" },
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
    });
  } catch { return "—"; }
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "Never";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return fmtDate(iso);
  } catch { return "—"; }
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 20 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin" style={{ color: "var(--accent)" }} />;
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────

function Checkbox({ checked, indeterminate, onChange }: {
  checked: boolean; indeterminate?: boolean; onChange: () => void;
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange(); }}
      className="w-5 h-5 rounded flex items-center justify-center border-none cursor-pointer shrink-0 transition-all"
      style={{
        background: checked || indeterminate ? "var(--accent)" : "var(--surface2)",
        border: `1.5px solid ${checked || indeterminate ? "var(--accent)" : "var(--border2)"}`,
      }}
    >
      {indeterminate ? <Minus size={10} color="#fff" /> : checked ? <Check size={10} color="#fff" /> : null}
    </button>
  );
}

// ─── Modal Shell ──────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, danger = false }: {
  title: string; onClose: () => void; children: React.ReactNode; danger?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto"
        style={{
          background: "var(--surface)",
          border: `1px solid ${danger ? "rgba(248,113,113,0.3)" : "var(--border2)"}`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold" style={{ color: "var(--text)" }}>{title}</h2>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center border-none cursor-pointer"
            style={{ background: "var(--surface2)", color: "var(--text3)" }}>
            <X size={13} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({ userIds, onClose, onSuccess }: {
  userIds: string[]; onClose: () => void; onSuccess: (ids: string[]) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const handleDelete = async () => {
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/admin/users/bulk-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds }),
      });
      const json = await res.json();
      if (json.success) { onSuccess(userIds); onClose(); }
      else setError(json.message || "Delete failed");
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="⚠️ Confirm Bulk Delete" onClose={onClose} danger>
      <div className="flex flex-col gap-4">
        <div className="rounded-xl p-4 flex items-start gap-3"
          style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
          <div className="shrink-0 mt-0.5"><AlertTriangle size={18} style={{ color: "#f87171" }} /></div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "#f87171" }}>
              This action cannot be undone
            </p>
            <p className="text-[13px] mt-1" style={{ color: "var(--text3)" }}>
              Permanently deleting{" "}
              <strong style={{ color: "var(--text)" }}>
                {userIds.length} user{userIds.length !== 1 ? "s" : ""}
              </strong>{" "}
              and all their work logs, diary entries, transactions, wallet data, and typing results.
            </p>
          </div>
        </div>
        {error && (
          <p className="text-[13px] px-3 py-2 rounded-lg"
            style={{ background: "rgba(248,113,113,0.08)", color: "#f87171" }}>{error}</p>
        )}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={loading}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold border-none cursor-pointer"
            style={{ background: "var(--surface2)", color: "var(--text3)" }}>
            Cancel
          </button>
          <button onClick={handleDelete} disabled={loading}
            className="px-5 py-2 rounded-xl text-[13px] font-semibold border-none cursor-pointer flex items-center gap-2"
            style={{ background: "#f87171", color: "#fff", opacity: loading ? 0.7 : 1 }}>
            {loading ? <Spinner size={13} /> : <Trash2 size={13} />}
            Delete {userIds.length} User{userIds.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Ban Device / IP Modal ────────────────────────────────────────────────────

function BanModal({ userId, device, banType, onClose, onSuccess }: {
  userId: string; device: Device; banType: "device" | "ip";
  onClose: () => void; onSuccess: () => void;
}) {
  const [reason,  setReason]  = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const value = banType === "device" ? device.deviceId : device.ip;
  const label = banType === "device" ? "Device" : "IP Address";

  const handleBan = async () => {
    if (!value) return;
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: banType, value, reason: reason.trim(), userId, userAgent: device.userAgent }),
      });
      const json = await res.json();
      if (json.success) { onSuccess(); onClose(); }
      else setError(json.message || "Ban failed");
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <Modal title={`🚫 Ban ${label} Globally`} onClose={onClose} danger>
      <div className="flex flex-col gap-4">
        <div className="rounded-xl p-3 flex flex-col gap-1"
          style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text4)" }}>
            {label} to ban
          </p>
          <p className="text-[13px] font-mono break-all" style={{ color: "var(--text)" }}>{value || "—"}</p>
          {banType === "device" && device.userAgent && (
            <p className="text-[11px]" style={{ color: "var(--text4)" }}>{device.userAgent.slice(0, 80)}…</p>
          )}
        </div>

        {/* Clear explanation of what global ban does */}
        <div className="rounded-xl p-3"
          style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)" }}>
          <p className="text-[12px] font-semibold mb-1" style={{ color: "#f87171" }}>
            🌐 What does a Global Ban do?
          </p>
          <p className="text-[12px]" style={{ color: "var(--text3)" }}>
            This {banType === "device" ? "device ID" : "IP address"} gets added to a global blocklist
            checked in <code style={{ color: "#a78bfa" }}>authGuard.ts</code> on every request.
            Even if this person creates a <strong>new account</strong>, they will be blocked
            the moment they try to log in from this {banType === "device" ? "device" : "IP"}.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold" style={{ color: "var(--text3)" }}>
            Reason (optional)
          </label>
          <textarea
            value={reason} onChange={e => setReason(e.target.value)}
            placeholder="e.g. Suspicious activity, multiple account abuse..."
            rows={3}
            className="rounded-xl px-3 py-2 text-[13px] resize-none border-none outline-none"
            style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border2)" }}
          />
        </div>
        {error && (
          <p className="text-[13px] px-3 py-2 rounded-lg"
            style={{ background: "rgba(248,113,113,0.08)", color: "#f87171" }}>{error}</p>
        )}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={loading}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold border-none cursor-pointer"
            style={{ background: "var(--surface2)", color: "var(--text3)" }}>
            Cancel
          </button>
          <button onClick={handleBan} disabled={loading || !value}
            className="px-5 py-2 rounded-xl text-[13px] font-semibold border-none cursor-pointer flex items-center gap-2"
            style={{ background: "#f87171", color: "#fff", opacity: (loading || !value) ? 0.7 : 1 }}>
            {loading ? <Spinner size={13} /> : <Ban size={13} />}
            Ban {label}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Bulk Ban Devices Modal ───────────────────────────────────────────────────

function BulkBanModal({ devices, onClose, onSuccess }: {
  devices: Array<{ userId: string; device: Device }>;
  onClose: () => void; onSuccess: () => void;
}) {
  const [reason,  setReason]  = useState("");
  const [banType, setBanType] = useState<"device" | "ip">("device");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const handleBulkBan = async () => {
    setLoading(true); setError("");
    try {
      const bans = devices
        .map(({ userId, device }) => ({
          type: banType,
          value: banType === "device" ? device.deviceId : device.ip,
          reason: reason.trim() || "Bulk banned by admin",
          userId,
        }))
        .filter(b => b.value);
      const res  = await fetch("/api/admin/devices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bans }),
      });
      const json = await res.json();
      if (json.success) { onSuccess(); onClose(); }
      else setError(json.message || "Bulk ban failed");
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="🚫 Bulk Ban Devices" onClose={onClose} danger>
      <div className="flex flex-col gap-4">
        <p className="text-[13px]" style={{ color: "var(--text3)" }}>
          Globally banning{" "}
          <strong style={{ color: "var(--text)" }}>
            {devices.length} device{devices.length !== 1 ? "s" : ""}
          </strong>.
          These will be blocked at the auth level across ALL accounts.
        </p>
        <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--border2)" }}>
          {(["device", "ip"] as const).map(t => (
            <button key={t} onClick={() => setBanType(t)}
              className="flex-1 py-2 text-[13px] font-semibold border-none cursor-pointer flex items-center justify-center gap-2"
              style={{
                background: banType === t ? "var(--accent)" : "var(--surface2)",
                color: banType === t ? "#fff" : "var(--text3)",
              }}>
              {t === "device" ? <Smartphone size={13} /> : <Globe size={13} />}
              Ban {t === "device" ? "Device ID" : "IP Address"}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
          {devices.slice(0, 10).map(({ device }, i) => (
            <div key={i} className="rounded-lg px-3 py-2 flex items-center gap-2"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
              {banType === "device"
                ? <Smartphone size={11} style={{ color: "var(--text4)" }} />
                : <Globe size={11} style={{ color: "var(--text4)" }} />}
              <span className="text-[12px] font-mono truncate" style={{ color: "var(--text3)" }}>
                {banType === "device" ? device.deviceId : device.ip}
              </span>
            </div>
          ))}
          {devices.length > 10 && (
            <p className="text-[11px] text-center" style={{ color: "var(--text4)" }}>
              +{devices.length - 10} more…
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold" style={{ color: "var(--text3)" }}>Reason</label>
          <input value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Reason for bulk ban..."
            className="rounded-xl px-3 py-2 text-[13px] border-none outline-none"
            style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border2)" }}
          />
        </div>
        {error && (
          <p className="text-[13px] px-3 py-2 rounded-lg"
            style={{ background: "rgba(248,113,113,0.08)", color: "#f87171" }}>{error}</p>
        )}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={loading}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold border-none cursor-pointer"
            style={{ background: "var(--surface2)", color: "var(--text3)" }}>
            Cancel
          </button>
          <button onClick={handleBulkBan} disabled={loading}
            className="px-5 py-2 rounded-xl text-[13px] font-semibold border-none cursor-pointer flex items-center gap-2"
            style={{ background: "#f87171", color: "#fff", opacity: loading ? 0.7 : 1 }}>
            {loading ? <Spinner size={13} /> : <Ban size={13} />}
            Ban {devices.length} {banType === "device" ? "Device" : "IP"}{devices.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Global Bans Panel ────────────────────────────────────────────────────────

function GlobalBansModal({ onClose }: { onClose: () => void }) {
  const [bans,     setBans]     = useState<BannedDevice[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState<"all" | "device" | "ip">("all");
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ type: filter, limit: "100" });
      if (search) p.set("search", search);
      const res  = await fetch(`/api/admin/devices?${p}`);
      const json = await res.json();
      if (json.success) setBans(json.bans || []);
    } finally { setLoading(false); }
  }, [filter, search]);

  useEffect(() => { load(); }, [load]);

  const unban = async (value: string) => {
    setRemoving(value);
    try {
      await fetch(`/api/admin/devices?value=${encodeURIComponent(value)}`, { method: "DELETE" });
      setBans(prev => prev.filter(b => b.value !== value));
    } finally { setRemoving(null); }
  };

  return (
    <Modal title="🛡️ Global Device & IP Bans" onClose={onClose}>
      <div className="flex flex-col gap-3">
        {/* How-it-works banner */}
        <div className="rounded-xl p-3"
          style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
          <p className="text-[12px] font-semibold mb-1" style={{ color: "#a78bfa" }}>
            🌐 How Global Bans Work
          </p>
          <p className="text-[12px]" style={{ color: "var(--text3)" }}>
            Every device ID and IP listed here is checked in{" "}
            <code style={{ color: "#a78bfa" }}>authGuard.ts</code> on every incoming request.
            To ban: expand any user row → click <strong>Ban Device</strong> or <strong>Ban IP</strong>
            next to their device. The ban will instantly appear here and block that
            device/IP system-wide, even across new accounts.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search device ID or IP…"
            className="flex-1 min-w-0 rounded-xl px-3 py-2 text-[13px] border-none outline-none"
            style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border2)" }}
          />
          {(["all", "device", "ip"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-xl text-[12px] font-semibold border-none cursor-pointer"
              style={{
                background: filter === f ? "rgba(232,67,147,0.15)" : "var(--surface2)",
                color: filter === f ? "var(--accent)" : "var(--text3)",
                border: filter === f ? "1px solid rgba(232,67,147,0.3)" : "1px solid transparent",
              }}>
              {f === "all" ? "All" : f === "device" ? "Devices" : "IPs"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : bans.length === 0 ? (
          <p className="text-center py-8 text-[13px]" style={{ color: "var(--text4)" }}>
            No active bans
          </p>
        ) : (
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
            {bans.map(ban => (
              <div key={ban._id}
                className="rounded-xl px-3 py-2.5 flex items-start justify-between gap-3"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <div className="flex items-start gap-2 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    {ban.type === "device"
                      ? <Smartphone size={13} style={{ color: "#a78bfa" }} />
                      : <Globe size={13} style={{ color: "#60a5fa" }} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-mono break-all" style={{ color: "var(--text)" }}>
                      {ban.value}
                    </p>
                    {ban.reason && (
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text4)" }}>{ban.reason}</p>
                    )}
                    <p className="text-[10px] mt-0.5 font-mono" style={{ color: "var(--text4)" }}>
                      Banned {fmtRelative(ban.bannedAt)}
                    </p>
                  </div>
                </div>
                <button onClick={() => unban(ban.value)} disabled={removing === ban.value}
                  className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold border-none cursor-pointer flex items-center gap-1"
                  style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}>
                  {removing === ban.value ? <Spinner size={10} /> : <ShieldOff size={10} />}
                  Unban
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-center" style={{ color: "var(--text4)" }}>
          {bans.length} active ban{bans.length !== 1 ? "s" : ""}
        </p>
      </div>
    </Modal>
  );
}

// ─── Device Row ───────────────────────────────────────────────────────────────

function DeviceRow({ device, userId, onBanDevice, onBanIp }: {
  device: Device; userId: string;
  onBanDevice: (userId: string, device: Device) => void;
  onBanIp:     (userId: string, device: Device) => void;
}) {
  return (
    <div className="rounded-xl px-3 py-2.5 flex flex-wrap items-center gap-3 justify-between"
      style={{
        background: device.isBanned ? "rgba(248,113,113,0.06)" : "var(--surface)",
        border: `1px solid ${device.isBanned ? "rgba(248,113,113,0.2)" : "var(--border)"}`,
      }}>
      <div className="flex items-center gap-2 min-w-0">
        <div className="shrink-0">
          <MonitorSmartphone size={13} style={{ color: device.isBanned ? "#f87171" : "var(--text4)" }} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono truncate"
              style={{ color: "var(--text3)", maxWidth: 160 }}>
              {device.deviceId || "Unknown"}
            </span>
            {device.isBanned && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}>
                BANNED
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px] font-mono" style={{ color: "var(--text4)" }}>
              {device.ip || "—"}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text4)" }}>
              · Last seen {fmtRelative(device.lastSeen)}
            </span>
          </div>
          {device.banReason && (
            <p className="text-[10px] mt-0.5" style={{ color: "#f87171" }}>
              Reason: {device.banReason}
            </p>
          )}
        </div>
      </div>
      {!device.isBanned && (
        <div className="flex gap-2 shrink-0">
          <button onClick={() => onBanDevice(userId, device)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border-none cursor-pointer flex items-center gap-1"
            style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa" }}>
            <Smartphone size={10} />
            Ban Device
          </button>
          {device.ip && (
            <button onClick={() => onBanIp(userId, device)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border-none cursor-pointer flex items-center gap-1"
              style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa" }}>
              <Globe size={10} />
              Ban IP
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── User Row ─────────────────────────────────────────────────────────────────

function UserRow({ user, selected, onSelect, onView, onBanDevice, onBanIp }: {
  user: User; selected: boolean; onSelect: () => void; onView: () => void;
  onBanDevice: (userId: string, device: Device) => void;
  onBanIp:     (userId: string, device: Device) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sc         = STATUS_COLORS[user.status] || STATUS_COLORS.active;
  const hasDevices = user.devices && user.devices.length > 0;

  return (
    <div className="rounded-xl overflow-hidden transition-all"
      style={{
        border: `1px solid ${selected ? "rgba(232,67,147,0.35)" : "var(--border2)"}`,
        background: selected ? "rgba(232,67,147,0.04)" : "var(--surface)",
      }}>
      <div className="flex items-center gap-3 px-4 py-3">
        {user.role !== "admin"
          ? <Checkbox checked={selected} onChange={onSelect} />
          : <div className="w-5 h-5 shrink-0" />}

        <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center font-bold text-[14px]"
          style={{ background: "rgba(232,67,147,0.12)", color: "var(--accent)" }}>
          {user.fullName?.charAt(0)?.toUpperCase() || "?"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[14px] truncate" style={{ color: "var(--text)" }}>
              {user.fullName}
            </span>
            {user.role === "admin" && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24" }}>
                ADMIN
              </span>
            )}
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
              style={{ background: sc.bg, color: sc.text }}>
              {user.status?.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[12px] flex-wrap" style={{ color: "var(--text4)" }}>
            <span className="truncate">{user.email}</span>
            {user.companyName && <span>· {user.companyName}</span>}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono shrink-0"
          style={{ color: "var(--text4)" }}>
          <span className="flex items-center gap-1">
            {hasDevices
              ? <><Wifi size={10} style={{ color: "#22d3a0" }} /> {user.devices.length} device{user.devices.length !== 1 ? "s" : ""}</>
              : <><WifiOff size={10} style={{ color: "#f87171" }} /> No devices</>}
          </span>
          <span>Last: {fmtRelative(user.lastLogin)}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasDevices && (
            <button onClick={() => setExpanded(e => !e)}
              className="w-7 h-7 rounded-lg flex items-center justify-center border-none cursor-pointer"
              style={{ background: "var(--surface2)", color: "var(--text4)" }}
              title="Show devices">
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
          <button onClick={onView}
            className="w-7 h-7 rounded-lg flex items-center justify-center border-none cursor-pointer"
            style={{ background: "var(--surface2)", color: "var(--text4)" }}
            title="View profile">
            <Eye size={13} />
          </button>
        </div>
      </div>

      {expanded && hasDevices && (
        <div className="px-4 pb-3 flex flex-col gap-2"
          style={{ borderTop: "1px solid var(--border2)" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mt-2.5"
            style={{ color: "var(--text4)" }}>
            Registered Devices
          </p>
          {user.devices.map((device, i) => (
            <DeviceRow
              key={i} device={device} userId={user._id}
              onBanDevice={onBanDevice} onBanIp={onBanIp}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UsersManagementPage() {
  const router = useRouter();

  const [users,      setUsers]      = useState<User[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [status,     setStatus]     = useState<"all" | "active" | "suspended" | "banned">("all");
  const [noDevice,   setNoDevice]   = useState(false);
  const [viewAll,    setViewAll]    = useState(false);   // removes pagination
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [modal,      setModal]      = useState<ModalType>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ search, status });

      if (viewAll) {
        p.set("page",  "1");
        p.set("limit", "9999");
      } else {
        p.set("page",  String(page));
        p.set("limit", "20");
      }

      // Tell the API to filter server-side when possible
      if (noDevice) p.set("noDevice", "true");

      const res  = await fetch(`/api/admin/users?${p}`);
      const json = await res.json();

      if (json.success) {
        let fetched: User[] = json.users || [];

        // ✅ Client-side safety net: always enforce noDevice filter
        // Works even if the API doesn't support the param yet
        if (noDevice) {
          fetched = fetched.filter(u => !u.devices || u.devices.length === 0);
        }

        setUsers(fetched);
        setTotalPages(json.pagination?.pages || 1);
        setTotalCount(noDevice ? fetched.length : (json.pagination?.total || 0));
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, status, noDevice, viewAll]);

  useEffect(() => {
    setSelected(new Set());
    loadUsers();
  }, [loadUsers]);

  // ── Search debounce ────────────────────────────────────────────────────────

  const handleSearchChange = (val: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setSearch(val); setPage(1); }, 350);
  };

  // ── Selection ─────────────────────────────────────────────────────────────

  const selectableUsers = users.filter(u => u.role !== "admin");
  const allSelected     = selectableUsers.length > 0 && selectableUsers.every(u => selected.has(u._id));
  const someSelected    = selectableUsers.some(u => selected.has(u._id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(prev => { const n = new Set(prev); selectableUsers.forEach(u => n.delete(u._id)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); selectableUsers.forEach(u => n.add(u._id)); return n; });
    }
  };

  const toggleUser = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleDeleteSuccess = (ids: string[]) => {
    setUsers(prev => prev.filter(u => !ids.includes(u._id)));
    setSelected(new Set());
  };

  const selectedDevices = users
    .filter(u => selected.has(u._id))
    .flatMap(u => (u.devices || []).filter(d => !d.isBanned).map(d => ({ userId: u._id, device: d })));

  // ── Pagination bar ─────────────────────────────────────────────────────────

  const PaginationBar = () => {
    if (viewAll || totalPages <= 1) return null;
    return (
      <div className="flex items-center gap-2 justify-center">
        <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
          className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer disabled:opacity-30"
          style={{ background: "var(--surface2)", color: "var(--text3)" }}>
          <ChevronLeft size={14} />
        </button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
          <button key={p} onClick={() => setPage(p)}
            className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer text-[13px] font-mono"
            style={{
              background: p === page ? "var(--accent)" : "var(--surface2)",
              color: p === page ? "#fff" : "var(--text3)",
              fontWeight: p === page ? 700 : 400,
            }}>{p}</button>
        ))}
        <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
          className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer disabled:opacity-30"
          style={{ background: "var(--surface2)", color: "var(--text3)" }}>
          <ChevronRight size={14} />
        </button>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto py-8 px-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--text)" }}>
            User Management
          </h1>
          <p className="text-[13px] mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: "var(--text4)" }}>
            {noDevice ? (
              <span style={{ color: "#f87171" }}>
                {totalCount} user{totalCount !== 1 ? "s" : ""} with no devices
              </span>
            ) : (
              <span>{totalCount} total user{totalCount !== 1 ? "s" : ""}</span>
            )}
            {selected.size > 0 && (
              <span style={{ color: "var(--accent)" }}>· {selected.size} selected</span>
            )}
            {viewAll && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: "rgba(34,211,160,0.15)", color: "#22d3a0" }}>
                ALL USERS
              </span>
            )}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setModal({ kind: "globalBans" })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold border-none cursor-pointer"
            style={{
              background: "rgba(167,139,250,0.12)", color: "#a78bfa",
              border: "1px solid rgba(167,139,250,0.25)",
            }}>
            <ShieldOff size={14} />
            Global Bans
          </button>
          <button onClick={loadUsers}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold border-none cursor-pointer"
            style={{ background: "var(--surface2)", color: "var(--text3)", border: "1px solid var(--border2)" }}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 items-center">

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text4)" }} />
          <input type="text" placeholder="Search by name, email…"
            onChange={e => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-[13px] border-none outline-none"
            style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border2)" }}
          />
        </div>

        {/* Status filter */}
        <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--border2)" }}>
          {(["all", "active", "suspended", "banned"] as const).map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }}
              className="px-3 py-2 text-[12px] font-semibold border-none cursor-pointer"
              style={{
                background: status === s ? "var(--accent)" : "var(--surface2)",
                color: status === s ? "#fff" : "var(--text3)",
              }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* ✅ No Device Only — with client-side fallback */}
        <button
          onClick={() => { setNoDevice(d => !d); setPage(1); }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold border-none cursor-pointer transition-all"
          style={{
            background: noDevice ? "rgba(248,113,113,0.15)" : "var(--surface2)",
            color:      noDevice ? "#f87171" : "var(--text3)",
            border:     noDevice ? "1px solid rgba(248,113,113,0.35)" : "1px solid var(--border2)",
          }}>
          <WifiOff size={13} />
          No Device Only
          {noDevice && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
              style={{ background: "rgba(248,113,113,0.2)", color: "#f87171" }}>
              ON
            </span>
          )}
        </button>

        {/* ✅ View All — disables pagination */}
        <button
          onClick={() => { setViewAll(v => !v); setPage(1); }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold border-none cursor-pointer transition-all"
          style={{
            background: viewAll ? "rgba(34,211,160,0.15)" : "var(--surface2)",
            color:      viewAll ? "#22d3a0" : "var(--text3)",
            border:     viewAll ? "1px solid rgba(34,211,160,0.35)" : "1px solid var(--border2)",
          }}>
          <List size={13} />
          View All
          {viewAll && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
              style={{ background: "rgba(34,211,160,0.2)", color: "#22d3a0" }}>
              ON
            </span>
          )}
        </button>
      </div>

      {/* ── Active filter pills ── */}
      {(noDevice || viewAll) && (
        <div className="flex flex-wrap gap-2">
          {noDevice && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px]"
              style={{
                background: "rgba(248,113,113,0.10)",
                border: "1px solid rgba(248,113,113,0.25)",
                color: "#f87171",
              }}>
              <WifiOff size={11} />
              Showing users with <strong className="mx-1">no registered devices</strong>
              <button onClick={() => setNoDevice(false)}
                className="ml-1 border-none bg-transparent cursor-pointer p-0 flex items-center"
                style={{ color: "#f87171" }}>
                <X size={11} />
              </button>
            </div>
          )}
          {viewAll && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px]"
              style={{
                background: "rgba(34,211,160,0.10)",
                border: "1px solid rgba(34,211,160,0.25)",
                color: "#22d3a0",
              }}>
              <List size={11} />
              Pagination off — showing all <strong className="mx-1">{users.length}</strong> users
              <button onClick={() => setViewAll(false)}
                className="ml-1 border-none bg-transparent cursor-pointer p-0 flex items-center"
                style={{ color: "#22d3a0" }}>
                <X size={11} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Bulk actions bar ── */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 flex-wrap px-4 py-3 rounded-xl"
          style={{ background: "rgba(232,67,147,0.08)", border: "1px solid rgba(232,67,147,0.2)" }}>
          <span className="text-[13px] font-semibold" style={{ color: "var(--accent)" }}>
            {selected.size} selected
          </span>
          <div className="flex-1" />
          {selectedDevices.length > 0 && (
            <button onClick={() => setModal({ kind: "bulkBanDevices", devices: selectedDevices })}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-[12px] font-semibold border-none cursor-pointer"
              style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}>
              <Ban size={13} />
              Ban All Devices ({selectedDevices.length})
            </button>
          )}
          <button onClick={() => setModal({ kind: "confirmDelete", userIds: Array.from(selected) })}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-[12px] font-semibold border-none cursor-pointer"
            style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}>
            <Trash2 size={13} />
            Delete Selected ({selected.size})
          </button>
          <button onClick={() => setSelected(new Set())}
            className="w-7 h-7 rounded-lg flex items-center justify-center border-none cursor-pointer"
            style={{ background: "var(--surface2)", color: "var(--text4)" }}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Table header ── */}
      <div className="flex items-center gap-3 px-4 py-2 rounded-xl"
        style={{ background: "var(--surface2)", border: "1px solid var(--border2)" }}>
        <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
        <span className="flex-1 text-[11px] font-bold uppercase tracking-wider"
          style={{ color: "var(--text4)" }}>User</span>
        <span className="hidden sm:block text-[11px] font-bold uppercase tracking-wider"
          style={{ color: "var(--text4)" }}>Devices / Last Login</span>
        <span className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: "var(--text4)" }}>Actions</span>
      </div>

      {/* ── User list ── */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          {noDevice
            ? <WifiOff size={36} style={{ color: "#f87171" }} />
            : <Users size={36} style={{ color: "var(--text4)" }} />}
          <p className="text-[14px]" style={{ color: "var(--text4)" }}>
            {noDevice ? "No users without devices found" : "No users found"}
          </p>
          {noDevice && (
            <p className="text-[12px]" style={{ color: "var(--text4)" }}>
              Every user has at least one registered device — good sign!
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map(user => (
            <UserRow
              key={user._id}
              user={user}
              selected={selected.has(user._id)}
              onSelect={() => toggleUser(user._id)}
              onView={() => router.push(`/admin/users/${user._id}`)}
              onBanDevice={(uid, device) => setModal({ kind: "banDevice", userId: uid, device })}
              onBanIp={(uid, device) => setModal({ kind: "banIp", userId: uid, device })}
            />
          ))}
        </div>
      )}

      {/* ── Pagination (hidden when viewAll is ON) ── */}
      <PaginationBar />

      {/* ── Modals ── */}
      {modal?.kind === "confirmDelete" && (
        <DeleteModal userIds={modal.userIds} onClose={() => setModal(null)} onSuccess={handleDeleteSuccess} />
      )}
      {modal?.kind === "banDevice" && (
        <BanModal userId={modal.userId} device={modal.device} banType="device"
          onClose={() => setModal(null)} onSuccess={loadUsers} />
      )}
      {modal?.kind === "banIp" && (
        <BanModal userId={modal.userId} device={modal.device} banType="ip"
          onClose={() => setModal(null)} onSuccess={loadUsers} />
      )}
      {modal?.kind === "bulkBanDevices" && (
        <BulkBanModal devices={modal.devices} onClose={() => setModal(null)} onSuccess={loadUsers} />
      )}
      {modal?.kind === "globalBans" && (
        <GlobalBansModal onClose={() => setModal(null)} />
      )}
    </div>
  );
}