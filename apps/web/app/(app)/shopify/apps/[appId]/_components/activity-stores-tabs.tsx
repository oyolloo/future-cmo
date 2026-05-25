"use client";

import { useState } from "react";

import { cn } from "@kit/ui/lib/utils";

type Tab = "stores" | "activity" | "listing" | "image-analysis" | "settings";

type Props = {
  activityContent: React.ReactNode;
  storesContent: React.ReactNode;
  listingContent: React.ReactNode;
  imageAnalysisContent: React.ReactNode;
  settingsContent: React.ReactNode;
  storesCount: number;
  eventsCount: number;
};

export function ActivityStoresTabs({
  activityContent,
  storesContent,
  listingContent,
  imageAnalysisContent,
  settingsContent,
  storesCount,
  eventsCount,
}: Props) {
  const [tab, setTab] = useState<Tab>("stores");

  const content: Record<Tab, React.ReactNode> = {
    stores: storesContent,
    activity: activityContent,
    listing: listingContent,
    "image-analysis": imageAnalysisContent,
    settings: settingsContent,
  };

  return (
    <div>
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
        <TabButton
          active={tab === "stores"}
          onClick={() => setTab("stores")}
          label="Stores"
          count={storesCount}
        />
        <TabButton
          active={tab === "activity"}
          onClick={() => setTab("activity")}
          label="Recent activity"
          count={eventsCount}
        />
        <TabButtonSimple
          active={tab === "listing"}
          onClick={() => setTab("listing")}
          label="Listing Audit"
        />
        <TabButtonSimple
          active={tab === "image-analysis"}
          onClick={() => setTab("image-analysis")}
          label="Image Analysis"
        />
        <TabButtonSimple
          active={tab === "settings"}
          onClick={() => setTab("settings")}
          label="Settings"
        />
      </div>
      <div className="mt-4">{content[tab]}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mb-px border-b-2 px-4 py-2 font-mono text-[0.6875rem] uppercase tracking-wider transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "ml-2 rounded px-1.5 py-0.5 text-[0.625rem]",
          active ? "bg-primary/15 text-primary" : "bg-muted/50",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function TabButtonSimple({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mb-px border-b-2 px-4 py-2 font-mono text-[0.6875rem] uppercase tracking-wider transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
