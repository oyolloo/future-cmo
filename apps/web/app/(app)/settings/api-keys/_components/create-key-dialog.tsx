"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ApiKey } from "@kit/database/schema";
import { Button } from "@kit/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@kit/ui/dialog";
import { Input } from "@kit/ui/input";
import { Label } from "@kit/ui/label";
import { createKeyAction } from "../_lib/actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (key: ApiKey) => void;
};

export function CreateKeyDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createKeyAction({ name, permissions: ["*"] });
      if (res.ok) {
        setCreatedKey(res.data.key);
        onCreated({
          id: crypto.randomUUID(),
          userId: "",
          name,
          keyHash: "",
          keyPrefix: res.data.keyPrefix,
          permissions: ["*"],
          rateLimit: 100,
          active: true,
          lastUsedAt: null,
          createdAt: new Date(),
        });
        toast.success("API key created");
      } else {
        toast.error(res.error.message);
      }
    });
  }

  function handleCopy() {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      toast.success("Copied to clipboard");
    }
  }

  function handleClose(next: boolean) {
    if (!next) {
      setName("");
      setCreatedKey(null);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {createdKey ? (
          <>
            <DialogHeader>
              <DialogTitle>Key created</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Copy this key now — you won&apos;t be able to see it again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-xs font-mono break-all select-all">
                  {createdKey}
                </code>
                <Button size="sm" variant="outline" onClick={handleCopy}>
                  Copy
                </Button>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Done</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key-name">Key name</Label>
                <Input
                  id="key-name"
                  placeholder="e.g. OyoLeads Extension"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  A label to help you identify this key later.
                </p>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending || !name.trim()}>
                {isPending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
