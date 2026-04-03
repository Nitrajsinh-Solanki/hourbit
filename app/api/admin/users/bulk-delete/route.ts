// app/api/admin/users/bulk-delete/route.ts
// DELETE multiple users from the database at once.
// Also cleans up related data: WorkLog, DiaryEntry, Transaction, Wallet, TypingResult, etc.

import { NextRequest, NextResponse } from "next/server";
import { connectDB }   from "@/app/lib/mongodb";
import User            from "@/app/models/User";

import { DiaryEntry }  from "@/app/models/DiaryEntry";
import { Transaction } from "@/app/models/Transaction";
import { Wallet }      from "@/app/models/Wallet";
import { cookies }     from "next/headers";
import jwt             from "jsonwebtoken";
import mongoose        from "mongoose";
import WorkLog from "@/app/models/WorkLog";

async function requireAdmin(): Promise<{ userId: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      role:   string;
    };
    if (decoded.role !== "admin") return null;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  let userIds: string[];
  try {
    const body = await req.json();
    userIds = body.userIds;
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 });
  }

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ success: false, message: "userIds array is required" }, { status: 400 });
  }

  // Validate all IDs are valid ObjectIds
  const validIds = userIds.filter(id => mongoose.Types.ObjectId.isValid(id));
  if (validIds.length === 0) {
    return NextResponse.json({ success: false, message: "No valid user IDs provided" }, { status: 400 });
  }

  await connectDB();

  // Prevent deleting admin accounts
  const usersToDelete = await User.find({
    _id: { $in: validIds },
    role: { $ne: "admin" },
  }).select("_id").lean();

  const safeIds = usersToDelete.map((u: any) => u._id);

  if (safeIds.length === 0) {
    return NextResponse.json({ success: false, message: "No eligible users to delete (admins are protected)" }, { status: 400 });
  }

  // Also prevent admin from deleting themselves
  const filteredIds = safeIds.filter(
    (id: any) => String(id) !== admin.userId
  );

  if (filteredIds.length === 0) {
    return NextResponse.json({ success: false, message: "Cannot delete your own admin account" }, { status: 400 });
  }

  // Delete all related data in parallel
  await Promise.all([
    User.deleteMany({ _id: { $in: filteredIds } }),
    // Try to delete related data — these models may not all exist but we catch errors gracefully
    (async () => {
      try { await WorkLog.deleteMany({ userId: { $in: filteredIds } }); } catch {}
    })(),
    (async () => {
      try { await DiaryEntry.deleteMany({ userId: { $in: filteredIds } }); } catch {}
    })(),
    (async () => {
      try { await Transaction.deleteMany({ userId: { $in: filteredIds } }); } catch {}
    })(),
    (async () => {
      try { await Wallet.deleteMany({ userId: { $in: filteredIds } }); } catch {}
    })(),
    // Delete typing results
    (async () => {
      try {
        const TypingResult = (await import("@/app/models/TypingModels")).TypingResult;
        await TypingResult.deleteMany({ userId: { $in: filteredIds } });
      } catch {}
    })(),
    // Delete quiz data
    (async () => {
      try {
        const { UserXp } = await import("@/app/models/brain/UserXp");
        await UserXp.deleteMany({ userId: { $in: filteredIds } });
      } catch {}
    })(),
  ]);

  return NextResponse.json({
    success: true,
    message: `Successfully deleted ${filteredIds.length} user(s) and all their associated data.`,
    deletedCount: filteredIds.length,
  });
}