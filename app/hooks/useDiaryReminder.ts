// app/hooks/useDiaryReminder.ts
//
// After a successful work-log save, call triggerDiaryReminder(entryTime, exitTime, date).
// The toast auto-dismisses immediately when the user navigates to a different route.

"use client";

import { useRouter, usePathname }        from "next/navigation";
import { useCallback }                   from "react";
import { showDiaryReminderToast }        from "@/app/components/DiaryReminderToast";

export function useDiaryReminder() {
  const router   = useRouter();
  const pathname = usePathname(); // captured at the moment the hook is used

  const triggerDiaryReminder = useCallback(
    async (
      entryTime: string | null | undefined,
      exitTime:  string | null | undefined,
      date:      string   // "YYYY-MM-DD"
    ): Promise<void> => {
      // Only show when BOTH entry AND exit are present
      if (!entryTime || !exitTime) return;

      try {
        const res = await fetch(`/api/diary/check-date?date=${date}`);
        if (!res.ok) return;

        const { exists } = (await res.json()) as { exists: boolean };

        // Only show if no diary entry exists for that date
        if (!exists) {
          showDiaryReminderToast(router, pathname);
        }
      } catch {
        // Network error — never block the user's workflow
      }
    },
    [router, pathname]
  );

  return { triggerDiaryReminder };
}