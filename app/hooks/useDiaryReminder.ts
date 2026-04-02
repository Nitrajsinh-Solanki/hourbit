// app/hooks/useDiaryReminder.ts
//
// Drop this hook into the Today's Track page.
// After a successful work-log save call triggerDiaryReminder(entryTime, exitTime, date).
// It will:
//   1. Bail out silently if either entryTime or exitTime is missing.
//   2. Call GET /api/diary/check-date?date=...
//   3. If the user has NOT written a diary entry for that date → show funny toast.
//   4. If the user HAS written a diary entry → do nothing.
//
// USAGE inside your today's track page:
//
//   import { useDiaryReminder } from "@/app/hooks/useDiaryReminder";
//
//   const { triggerDiaryReminder } = useDiaryReminder();
//
//   // Inside handleSave, AFTER the successful save response:
//   const logDate = "YYYY-MM-DD";   // today's date in UTC
//   await triggerDiaryReminder(entryTime, exitTime, logDate);
//
// NOTE: entryTime / exitTime are the "HH:MM" strings the user typed.
//       Pass null / undefined / "" to indicate "not set".

"use client";

import { useRouter }               from "next/navigation";
import { useCallback }             from "react";
import { showDiaryReminderToast }  from "@/app/components/DiaryReminderToast";

export function useDiaryReminder() {
  const router = useRouter();

  const triggerDiaryReminder = useCallback(
    async (
      entryTime: string | null | undefined,
      exitTime:  string | null | undefined,
      date:      string   // "YYYY-MM-DD"
    ): Promise<void> => {
      // ── Rule 1: Only show toast when BOTH entry AND exit are present ──────
      if (!entryTime || !exitTime) return;

      try {
        const res  = await fetch(`/api/diary/check-date?date=${date}`);
        if (!res.ok) return; // silently skip on error

        const { exists } = (await res.json()) as { exists: boolean };

        // ── Rule 2: Only show toast if NO diary entry for that date ──────────
        if (!exists) {
          showDiaryReminderToast(router);
        }
      } catch {
        // Network error — do nothing, never block the user's workflow
      }
    },
    [router]
  );

  return { triggerDiaryReminder };
}