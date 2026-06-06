"use server";

import { requireUser } from "@/lib/auth/session";
import { findEmailsOnWebsite } from "@/lib/audit/email-finder";

export async function findEmailsAction(url: string) {
  await requireUser();
  return findEmailsOnWebsite(url);
}
