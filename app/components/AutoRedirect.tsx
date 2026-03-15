// app/components/AutoRedirect.tsx
// ─────────────────────────────────────────────────────────────────────────────
// On mount it calls /api/auth/me — if the token is valid, it redirects based
// on the user's role:
//   - role === "admin"    → /admin
//   - role === "employee" → /dashboard
// Renders nothing visible — purely a redirect side-effect.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AutoRedirect() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          if (data.user?.role === "admin") {
            router.replace("/admin");
          } else {
            router.replace("/dashboard");
          }
        }
      })
      .catch(() => {
        // No valid token — stay on the page, do nothing
      });
  }, [router]);

  return null;
}