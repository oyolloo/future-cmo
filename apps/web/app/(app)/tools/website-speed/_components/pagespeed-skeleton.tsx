import { PagespeedProgress } from "./pagespeed-progress";

/**
 * Loading state for the Website Speed tool. Just the live progress bar —
 * we used to mirror the result layout in skeleton blocks, but the
 * progress bar already communicates loading and the skeleton was visual
 * noise on top of it.
 */
export function PagespeedSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <PagespeedProgress />
    </div>
  );
}
