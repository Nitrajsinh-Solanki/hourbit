// app/dashboard/page.tsx

import { redirect } from "next/navigation";

// Dashboard root → always land on Today's Track
export default function DashboardPage() {
  redirect("/dashboard/today");
}