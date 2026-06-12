"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ApiKey } from "@kit/database/schema";
import { Button } from "@kit/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@kit/ui/card";
import { CreateKeyDialog } from "./create-key-dialog";
import { KeyRow } from "./key-row";
import { revokeKeyAction } from "../_lib/actions";

type Props = { initialKeys: ApiKey[] };

export function ApiKeysPanel({ initialKeys }: Props) {
  const [keys, setKeys] = useState(initialKeys);
  const [showCreate, setShowCreate] = useState(false);
  const [revoking, startRevoke] = useTransition();

  function handleCreated(newKey: ApiKey) {
    setKeys((prev) => [newKey, ...prev]);
  }

  function handleRevoke(id: string) {
    startRevoke(async () => {
      const res = await revokeKeyAction(id);
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
        toast.success("API key revoked");
      } else {
        toast.error(res.error.message);
      }
    });
  }

  const activeKeys = keys.filter((k) => k.active);

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Your API Keys</CardTitle>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            Create key
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {activeKeys.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              No API keys yet. Create one to get started.
            </p>
          ) : (
            <div className="divide-y">
              {activeKeys.map((k) => (
                <KeyRow
                  key={k.id}
                  apiKey={k}
                  onRevoke={() => handleRevoke(k.id)}
                  revoking={revoking}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateKeyDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={handleCreated}
      />
    </>
  );
}
