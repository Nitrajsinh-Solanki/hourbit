// app/admin/users/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users, Search, Shield, ShieldOff, ShieldAlert,
  Monitor, Trash2, RefreshCw, ChevronLeft, ChevronRight
} from "lucide-react";
import toast from "react-hot-toast";

type DeviceStatus = {
  deviceId:  string;
  ipAddress: string;
  userAgent: string;
  lastLogin: string;
  isBanned:  boolean;
  banReason: string;
};

type UserRow = {
  _id:        string;
  fullName:   string;
  email:      string;
  status:     "active" | "suspended" | "banned";
  banReason:  string;
  bannedAt:   string | null;
  lastLogin:  string | null;
  createdAt:  string;
  companyName: string;
  devices:    DeviceStatus[];
};

const STATUS_COLORS = {
  active:    { text: "#22d3a0", bg: "rgba(34,211,160,0.12)",   border: "rgba(34,211,160,0.30)"  },
  suspended: { text: "#fbbf24", bg: "rgba(251,191,36,0.12)",   border: "rgba(251,191,36,0.30)"  },
  banned:    { text: "#f87171", bg: "rgba(248,113,113,0.12)",   border: "rgba(248,113,113,0.30)" },
};

export default function UserManagementPage() {
  const [users,       setUsers]       = useState<UserRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [actionUser,  setActionUser]  = useState<UserRow | null>(null);
  const [actionType,  setActionType]  = useState<"ban" | "suspend" | "unban" | null>(null);
  const [banReason,   setBanReason]   = useState("");
  const [suspendUntil, setSuspendUntil] = useState("");
  const [saving,      setSaving]      = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page:   String(page),
        limit:  "20",
        status: statusFilter,
        search,
      });
      const res  = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
        setTotalPages(data.pagination.pages || 1);
      }
    } catch { toast.error("Failed to load users"); }
    finally { setLoading(false); }
  }, [page, statusFilter, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchUsers(); }, 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleStatusChange = async () => {
    if (!actionUser || !actionType) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { banReason };
      if (actionType === "ban")     body.status = "banned";
      if (actionType === "unban")   body.status = "active";
      if (actionType === "suspend") { body.status = "suspended"; body.suspendUntil = suspendUntil; }

      const res  = await fetch(`/api/admin/users/${actionUser._id}/status`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.message); return; }
      toast.success(data.message);
      setActionUser(null);
      setActionType(null);
      setBanReason("");
      setSuspendUntil("");
      fetchUsers();
    } catch { toast.error("Action failed"); }
    finally { setSaving(false); }
  };

  const handleDeviceBan = async (userId: string, deviceId: string, isBanned: boolean) => {
    try {
      const res  = await fetch(`/api/admin/users/${userId}/devices`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ deviceId, isBanned }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.message); return; }
      toast.success(data.message);
      fetchUsers();
    } catch { toast.error("Device action failed"); }
  };

  const handleDeviceRemove = async (userId: string, deviceId: string) => {
    if (!confirm("Remove this device from the user's account?")) return;
    try {
      const res  = await fetch(`/api/admin/users/${userId}/devices?deviceId=${deviceId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.message); return; }
      toast.success("Device removed");
      fetchUsers();
    } catch { toast.error("Failed to remove device"); }
  };

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="rounded-2xl px-6 py-5"
        style={{ background: "linear-gradient(135deg,rgba(248,113,113,0.10),rgba(124,110,243,0.10))", border: "1px solid rgba(248,113,113,0.20)" }}>
        <div className="flex items-center gap-2 mb-1">
          <Users size={18} style={{ color: "#f87171" }} />
          <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "#f87171" }}>
            User Management
          </span>
        </div>
        <h1 className="text-[22px] font-bold" style={{ color: "var(--text)" }}>
          Manage Users & Devices
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--text3)" }}>
          Ban accounts, suspend users, or block specific devices.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text3)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search email or name..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px] font-mono border-none outline-none"
            style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border2)" }}
          />
        </div>

        {["all", "active", "suspended", "banned"].map(s => (
          <button key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className="px-4 py-2 rounded-xl text-[12px] font-semibold font-mono capitalize border-none cursor-pointer transition-all"
            style={{
              background: statusFilter === s ? "var(--accent)" : "var(--surface)",
              color:      statusFilter === s ? "#fff" : "var(--text3)",
              border:     "1px solid var(--border2)",
            }}
          >
            {s}
          </button>
        ))}

        <button onClick={fetchUsers}
          className="w-9 h-9 rounded-xl flex items-center justify-center border-none cursor-pointer"
          style={{ background: "var(--surface)", color: "var(--text3)", border: "1px solid var(--border2)" }}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border2)", background: "var(--surface)" }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          </div>
        ) : users.length === 0 ? (
          <p className="text-center py-16 font-mono text-[13px]" style={{ color: "var(--text3)" }}>No users found.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border2)" }}>
                {["User", "Status", "Last Login", "Devices", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold tracking-widest uppercase"
                    style={{ color: "var(--text4)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const sc = STATUS_COLORS[user.status];
                return (
                  <>
                    <tr key={user._id}
                      style={{ borderBottom: "1px solid var(--border2)", cursor: "pointer" }}
                      onClick={() => setExpanded(expanded === user._id ? null : user._id)}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[13px]" style={{ color: "var(--text)" }}>{user.fullName || "—"}</p>
                        <p className="text-[12px] font-mono" style={{ color: "var(--text3)" }}>{user.email}</p>
                        {user.companyName && <p className="text-[11px]" style={{ color: "var(--text4)" }}>{user.companyName}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider"
                          style={{ color: sc.text, background: sc.bg, border: `1px solid ${sc.border}` }}>
                          {user.status}
                        </span>
                        {user.banReason && <p className="text-[11px] mt-1 font-mono" style={{ color: "var(--text4)" }}>{user.banReason}</p>}
                      </td>
                      <td className="px-4 py-3 text-[12px] font-mono" style={{ color: "var(--text3)" }}>
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : "Never"}
                      </td>
                      <td className="px-4 py-3 text-[12px] font-mono" style={{ color: "var(--text3)" }}>
                        {user.devices?.length || 0} device(s)
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {user.status !== "banned" && (
                            <button
                              onClick={e => { e.stopPropagation(); setActionUser(user); setActionType("ban"); }}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border-none cursor-pointer"
                              style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}>
                              Ban
                            </button>
                          )}
                          {user.status !== "suspended" && user.status !== "banned" && (
                            <button
                              onClick={e => { e.stopPropagation(); setActionUser(user); setActionType("suspend"); }}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border-none cursor-pointer"
                              style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>
                              Suspend
                            </button>
                          )}
                          {user.status !== "active" && (
                            <button
                              onClick={e => { e.stopPropagation(); setActionUser(user); setActionType("unban"); }}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border-none cursor-pointer"
                              style={{ background: "rgba(34,211,160,0.15)", color: "#22d3a0" }}>
                              Restore
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded device list */}
                    {expanded === user._id && (
                      <tr key={`${user._id}-devices`}>
                        <td colSpan={5} className="px-6 pb-4 pt-2"
                          style={{ background: "rgba(0,0,0,0.2)" }}>
                          <p className="text-[11px] font-bold tracking-widest uppercase mb-3 flex items-center gap-2"
                            style={{ color: "var(--text4)" }}>
                            <Monitor size={12} /> Registered Devices
                          </p>
                          {(!user.devices || user.devices.length === 0) ? (
                            <p className="text-[12px] font-mono" style={{ color: "var(--text4)" }}>No devices registered.</p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {user.devices.map(dev => (
                                <div key={dev.deviceId}
                                  className="flex items-center justify-between rounded-xl px-4 py-3"
                                  style={{ background: "var(--surface)", border: `1px solid ${dev.isBanned ? "rgba(248,113,113,0.30)" : "var(--border2)"}` }}>
                                  <div>
                                    <p className="text-[12px] font-mono" style={{ color: "var(--text)" }}>
                                      {dev.userAgent?.slice(0, 60) || "Unknown agent"}
                                    </p>
                                    <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--text4)" }}>
                                      IP: {dev.ipAddress} · Last: {dev.lastLogin ? new Date(dev.lastLogin).toLocaleString() : "—"}
                                    </p>
                                    {dev.isBanned && (
                                      <span className="text-[11px]" style={{ color: "#f87171" }}>🚫 Device Banned</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {dev.isBanned ? (
                                      <button
                                        onClick={() => handleDeviceBan(user._id, dev.deviceId, false)}
                                        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border-none cursor-pointer"
                                        style={{ background: "rgba(34,211,160,0.15)", color: "#22d3a0" }}>
                                        Unban Device
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleDeviceBan(user._id, dev.deviceId, true)}
                                        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border-none cursor-pointer"
                                        style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}>
                                        Ban Device
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeviceRemove(user._id, dev.deviceId)}
                                      className="w-7 h-7 rounded-lg flex items-center justify-center border-none cursor-pointer"
                                      style={{ background: "var(--surface2)", color: "var(--text4)" }}>
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center border-none cursor-pointer disabled:opacity-40"
            style={{ background: "var(--surface)", color: "var(--text3)" }}>
            <ChevronLeft size={16} />
          </button>
          <span className="font-mono text-[13px]" style={{ color: "var(--text3)" }}>
            Page {page} of {totalPages}
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center border-none cursor-pointer disabled:opacity-40"
            style={{ background: "var(--surface)", color: "var(--text3)" }}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Ban/Suspend/Restore Modal */}
      {actionUser && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-[420px] rounded-2xl p-6"
            style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}>
            <h2 className="text-[18px] font-bold mb-1" style={{ color: "var(--text)" }}>
              {actionType === "ban"     && "🚫 Permanently Ban User"}
              {actionType === "suspend" && "⏸ Suspend User"}
              {actionType === "unban"   && "✅ Restore User Account"}
            </h2>
            <p className="text-[13px] font-mono mb-4" style={{ color: "var(--text3)" }}>
              {actionUser.fullName} ({actionUser.email})
            </p>

            {actionType !== "unban" && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider mb-1 block" style={{ color: "var(--text4)" }}>
                    Reason (optional)
                  </label>
                  <input
                    value={banReason}
                    onChange={e => setBanReason(e.target.value)}
                    placeholder="Enter reason..."
                    className="w-full px-4 py-2.5 rounded-xl text-[13px] font-mono border-none outline-none"
                    style={{ background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border2)" }}
                  />
                </div>

                {actionType === "suspend" && (
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider mb-1 block" style={{ color: "var(--text4)" }}>
                      Suspend Until
                    </label>
                    <input
                      type="datetime-local"
                      value={suspendUntil}
                      onChange={e => setSuspendUntil(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-[13px] font-mono border-none outline-none"
                      style={{ background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border2)" }}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setActionUser(null); setActionType(null); setBanReason(""); }}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold border-none cursor-pointer"
                style={{ background: "var(--surface2)", color: "var(--text3)" }}>
                Cancel
              </button>
              <button
                disabled={saving}
                onClick={handleStatusChange}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold border-none cursor-pointer disabled:opacity-50"
                style={{
                  background: actionType === "unban"   ? "rgba(34,211,160,0.20)"   :
                              actionType === "suspend" ? "rgba(251,191,36,0.20)"   :
                                                         "rgba(248,113,113,0.20)",
                  color:      actionType === "unban"   ? "#22d3a0" :
                              actionType === "suspend" ? "#fbbf24" : "#f87171",
                }}>
                {saving ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}