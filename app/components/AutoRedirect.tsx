// app/components/AutoRedirect.tsx
// ─────────────────────────────────────────────────────────────
// Drop this into any public page (home, login).
// On mount it calls /api/auth/me — if the token is valid
// (user remembered login), it redirects straight to /dashboard.
// Renders nothing visible — purely a redirect side-effect.
// ─────────────────────────────────────────────────────────────

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AutoRedirect() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          router.replace("/dashboard");
        }
      })
      .catch(() => {
        // No valid token — stay on the page, do nothing
      });
  }, [router]);

  return null;
}