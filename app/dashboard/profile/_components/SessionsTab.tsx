// app/dashboard/profile/_components/SessionsTab.tsx
"use client";

import { useEffect, useState } from "react";
import {
  Monitor,
  Smartphone,
  Tablet,
  Trash2,
  ShieldBan,
  ShieldCheck,
  MapPin,
  Clock,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "react-hot-toast";

type Session = {
  deviceId:   string;
  ipAddress:  string;
  userAgent:  string;
  lastLogin:  string | null;
  isBanned:   boolean;
  banReason:  string;
  isCurrent:  boolean;
};

type SessionsTabProps = {
  userEmail: string;
};

export default function SessionsTab({ userEmail }: SessionsTabProps) {
  const [sessions,   setSessions]   = useState<Session[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res  = await fetch("/api/auth/profile/sessions");
      const data = await res.json();
      if (data.success) setSessions(data.sessions);
      else toast.error(data.message || "Failed to load sessions");
    } catch (err: any) {
      toast.error(err.message || "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSessions(); }, []);

  const handleRemoveSession = async (deviceId: string) => {
    if (!confirm("Remove this session? That device will be logged out.")) return;

    try {
      setActionLoading(deviceId);
      const res  = await fetch("/api/auth/profile/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success("Session removed successfully");
        await fetchSessions();
      } else {
        toast.error(data.message || "Failed to remove session");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to remove session");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveAllSessions = async () => {
    if (!confirm("Remove ALL other sessions? Those devices will be logged out.")) return;

    try {
      setActionLoading("all");
      const res  = await fetch("/api/auth/profile/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: "all" }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success("All other sessions removed");
        await fetchSessions();
      } else {
        toast.error(data.message || "Failed to remove sessions");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to remove sessions");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBanSession = async (deviceId: string, currentlyBanned: boolean) => {
    const action = currentlyBanned ? "unban" : "ban";
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} this device? ${!currentlyBanned ? "It will be permanently blocked from accessing your account." : ""}`)) return;

    try {
      setActionLoading(deviceId);
      const res  = await fetch("/api/auth/profile/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, ban: !currentlyBanned }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        await fetchSessions();
      } else {
        toast.error(data.message || `Failed to ${action} session`);
      }
    } catch (err: any) {
      toast.error(err.message || `Failed to ${action} session`);
    } finally {
      setActionLoading(null);
    }
  };

  const getDeviceIcon = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
      return <Smartphone className="h-5 w-5" style={{ color: "var(--accent)" }} />;
    }
    if (ua.includes("tablet") || ua.includes("ipad")) {
      return <Tablet className="h-5 w-5" style={{ color: "var(--accent)" }} />;
    }
    return <Monitor className="h-5 w-5" style={{ color: "var(--accent)" }} />;
  };

  const getBrowserInfo = (userAgent: string) => {
    if (userAgent === "Unknown") return "Unknown Device";
    
    let browser = "Unknown Browser";
    let os = "Unknown OS";

    // Detect browser
    if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) browser = "Chrome";
    else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) browser = "Safari";
    else if (userAgent.includes("Firefox")) browser = "Firefox";
    else if (userAgent.includes("Edg")) browser = "Edge";

    // Detect OS
    if (userAgent.includes("Windows")) os = "Windows";
    else if (userAgent.includes("Mac")) os = "macOS";
    else if (userAgent.includes("Linux")) os = "Linux";
    else if (userAgent.includes("Android")) os = "Android";
    else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) os = "iOS";

    return `${browser} on ${os}`;
  };

  const otherSessions = sessions.filter((s) => !s.isCurrent);
  const currentSession = sessions.find((s) => s.isCurrent);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(124,110,243,0.12)", border: "1px solid rgba(124,110,243,0.22)" }}
          >
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--accent)" }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--text3)" }}>Loading sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold" style={{ color: "var(--text)" }}>
          Active Sessions
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>
          Manage your active sessions and security settings.
        </p>
      </div>

      {/* Current Session */}
      {currentSession && (
        <div
          className="rounded-2xl p-6 space-y-4"
          style={{
            background: "linear-gradient(135deg, rgba(124,110,243,0.08), rgba(34,211,160,0.08))",
            border: "1px solid rgba(124,110,243,0.22)",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                style={{
                  background: "linear-gradient(135deg, rgba(124,110,243,0.15), rgba(34,211,160,0.15))",
                  border: "1px solid rgba(124,110,243,0.3)",
                }}
              >
                {getDeviceIcon(currentSession.userAgent)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
                    {getBrowserInfo(currentSession.userAgent)}
                  </h3>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      background: "rgba(34,211,160,0.15)",
                      color: "var(--success)",
                      border: "1px solid rgba(34,211,160,0.3)",
                    }}
                  >
                    <CheckCircle2 className="h-3 w-3 inline mr-1" />
                    Current
                  </span>
                </div>

                <div className="space-y-1.5 mt-2">
                  <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text3)" }}>
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{currentSession.ipAddress}</span>
                  </div>
                  {currentSession.lastLogin && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text3)" }}>
                      <Clock className="h-3.5 w-3.5" />
                      <span>Last active: {new Date(currentSession.lastLogin).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Other Sessions */}
      {otherSessions.length > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
              Other Devices
            </h3>
            <button
              onClick={handleRemoveAllSessions}
              disabled={actionLoading === "all"}
              className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "rgba(248,113,113,0.10)",
                color: "var(--danger)",
                border: "1px solid rgba(248,113,113,0.25)",
              }}
            >
              {actionLoading === "all" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Remove All
                </>
              )}
            </button>
          </div>

          <div className="space-y-3">
            {otherSessions.map((session) => (
              <div
                key={session.deviceId}
                className="rounded-2xl p-5 transition-all"
                style={{
                  background: session.isBanned 
                    ? "rgba(248,113,113,0.05)" 
                    : "var(--surface)",
                  border: session.isBanned
                    ? "1px solid rgba(248,113,113,0.25)"
                    : "1px solid var(--border2)",
                }}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        background: session.isBanned
                          ? "rgba(248,113,113,0.12)"
                          : "rgba(124,110,243,0.10)",
                        border: session.isBanned
                          ? "1px solid rgba(248,113,113,0.22)"
                          : "1px solid rgba(124,110,243,0.22)",
                      }}
                    >
                      {getDeviceIcon(session.userAgent)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
                          {getBrowserInfo(session.userAgent)}
                        </h4>
                        {session.isBanned && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                            style={{
                              background: "rgba(248,113,113,0.15)",
                              color: "var(--danger)",
                              border: "1px solid rgba(248,113,113,0.3)",
                            }}
                          >
                            <XCircle className="h-3 w-3" />
                            Banned
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 mt-2">
                        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text3)" }}>
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{session.ipAddress}</span>
                        </div>
                        {session.lastLogin && (
                          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text3)" }}>
                            <Clock className="h-3 w-3" />
                            <span>Last active: {new Date(session.lastLogin).toLocaleString()}</span>
                          </div>
                        )}
                        {session.isBanned && session.banReason && (
                          <div className="flex items-start gap-2 text-xs mt-2" style={{ color: "var(--danger)" }}>
                            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>{session.banReason}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleBanSession(session.deviceId, session.isBanned)}
                      disabled={actionLoading === session.deviceId}
                      className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: session.isBanned
                          ? "rgba(34,211,160,0.10)"
                          : "rgba(251,191,36,0.10)",
                        color: session.isBanned ? "var(--success)" : "var(--warning)",
                        border: session.isBanned
                          ? "1px solid rgba(34,211,160,0.25)"
                          : "1px solid rgba(251,191,36,0.25)",
                      }}
                    >
                      {actionLoading === session.deviceId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : session.isBanned ? (
                        <>
                          <ShieldCheck className="h-4 w-4" />
                          <span className="hidden sm:inline">Unban</span>
                        </>
                      ) : (
                        <>
                          <ShieldBan className="h-4 w-4" />
                          <span className="hidden sm:inline">Ban</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleRemoveSession(session.deviceId)}
                      disabled={actionLoading === session.deviceId}
                      className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: "rgba(248,113,113,0.10)",
                        color: "var(--danger)",
                        border: "1px solid rgba(248,113,113,0.25)",
                      }}
                    >
                      {actionLoading === session.deviceId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          <span className="hidden sm:inline">Delete</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : sessions.length === 0 ? (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{
              background: "rgba(124,110,243,0.10)",
              border: "1px solid rgba(124,110,243,0.22)",
            }}
          >
            <Monitor className="h-6 w-6" style={{ color: "var(--accent)" }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>No sessions found</p>
          <p className="text-xs mt-1" style={{ color: "var(--text3)" }}>Your active sessions will appear here.</p>
        </div>
      ) : (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border2)" }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{
              background: "rgba(34,211,160,0.10)",
              border: "1px solid rgba(34,211,160,0.22)",
            }}
          >
            <CheckCircle2 className="h-6 w-6" style={{ color: "var(--success)" }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            No other active sessions
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text3)" }}>
            You're only logged in on this device.
          </p>
        </div>
      )}

      {/* Info Box */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: "rgba(124,110,243,0.06)",
          border: "1px solid rgba(124,110,243,0.18)",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: "rgba(124,110,243,0.12)",
              border: "1px solid rgba(124,110,243,0.22)",
            }}
          >
            <AlertTriangle className="h-4 w-4" style={{ color: "var(--accent)" }} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              Session Management
            </p>
            <div className="space-y-1.5 text-xs" style={{ color: "var(--text3)" }}>
              <p>
                <strong style={{ color: "var(--text2)" }}>Ban:</strong> Permanently blocks the device from accessing your account, even with correct credentials.
              </p>
              <p>
                <strong style={{ color: "var(--text2)" }}>Delete:</strong> Logs out the device but allows re-login with correct username and password.
              </p>
              <p>
                <strong style={{ color: "var(--text2)" }}>Note:</strong> You cannot ban or delete your current active session.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}