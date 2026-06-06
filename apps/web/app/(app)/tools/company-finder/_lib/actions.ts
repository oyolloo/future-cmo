"use server";

import { requireUser } from "@/lib/auth/session";
import { findCompanyIntel } from "@/lib/intel/company-finder";

export async function findCompanyAction(url: string) {
  await requireUser();
  return findCompanyIntel(url);
}
