"use client";

import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { Input } from "@kit/ui/input";
import { Label } from "@kit/ui/label";

import {
  generatePersonaAction,
  type PersonaGenerateState,
} from "../_lib/actions";

import { PersonaResults } from "./persona-results";
import { PersonaSkeleton } from "./persona-skeleton";

export function PersonaTool() {
  const [businessType, setBusinessType] = useState("");
  const [targetMarket, setTargetMarket] = useState("");
  const [currentCustomers, setCurrentCustomers] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [state, setState] = useState<PersonaGenerateState | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await generatePersonaAction({
        businessType,
        targetMarket,
        currentCustomers,
        productPrice,
      });
      setState(result);
    });
  };

  return (
    <div className="space-y-8">
      <form
        onSubmit={onSubmit}
        className="rounded-lg border border-border bg-card p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="biz" className="text-label">
              What does the business do?
            </Label>
            <Input
              id="biz"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="e.g. SaaS app for Shopify merchants that manages product tables"
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="market" className="text-label">
              Who is the target market?
            </Label>
            <Input
              id="market"
              value={targetMarket}
              onChange={(e) => setTargetMarket(e.target.value)}
              placeholder="e.g. Shopify store owners selling 500+ products who need better product display"
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customers" className="text-label">
              Current customers{" "}
              <span className="text-muted-foreground/60">(optional)</span>
            </Label>
            <Input
              id="customers"
              value={currentCustomers}
              onChange={(e) => setCurrentCustomers(e.target.value)}
              placeholder="e.g. mostly US-based fashion stores with 1000+ SKUs"
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price" className="text-label">
              Price point{" "}
              <span className="text-muted-foreground/60">(optional)</span>
            </Label>
            <Input
              id="price"
              value={productPrice}
              onChange={(e) => setProductPrice(e.target.value)}
              placeholder="e.g. $9.99/mo starter, $19.99/mo pro"
              disabled={isPending}
            />
          </div>
        </div>

        {state && !state.ok ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {state.error.message}
          </p>
        ) : null}

        <div className="mt-4 flex items-center gap-3">
          <Button
            type="submit"
            disabled={
              isPending || !businessType.trim() || !targetMarket.trim()
            }
          >
            {isPending ? "Generating…" : "Generate 3 personas"}
          </Button>
          <p className="text-comment">
            {"// saved automatically to your persona library"}
          </p>
        </div>
      </form>

      {isPending ? (
        <PersonaSkeleton />
      ) : state?.ok ? (
        <PersonaResults data={state.data} />
      ) : null}
    </div>
  );
}
