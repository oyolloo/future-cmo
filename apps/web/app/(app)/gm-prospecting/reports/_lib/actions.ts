"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { deleteReport } from "@/lib/reports/service";

export async function deleteReportAction(
  reportId: string,
): Promise<{ ok: true } | { ok: false; error: { message: string } }> {
  const user = await requireUser();

  if (!/^[0-9a-f-]{36}$/i.test(reportId)) {
    return { ok: false, error: { message: "Invalid report id." } };
  }

  const deleted = await deleteReport(user.id, reportId);
  if (!deleted) {
    return { ok: false, error: { message: "Report not found." } };
  }

  revalidatePath("/gm-prospecting/reports");
  return { ok: true };
}
