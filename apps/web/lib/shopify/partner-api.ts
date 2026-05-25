import "server-only";

/**
 * Typed Shopify Partner GraphQL client. Caller passes:
 *  - organizationId — from Partner Dashboard URL
 *  - accessToken     — from Partner Dashboard → Settings → Partner API clients
 *
 * Rate limit: 4 req/sec per Partner API client. We throttle every
 * sequential request from the same client instance.
 *
 * API version: 2026-04 (Shopify quarterly cadence — bump per release).
 */

const API_VERSION = "2026-04";
const RATE_LIMIT_DELAY_MS = 260; // ≈ 3.85 req/s — safely under 4 req/s ceiling

type GraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
};

export type PartnerApiError =
  | { kind: "http_error"; status: number; message: string }
  | { kind: "graphql_error"; messages: string[] }
  | { kind: "network"; message: string }
  | { kind: "timeout" };

// ─── Client ──────────────────────────────────────────────────────────

export type PartnerClient = {
  organizationId: string;
  request: <T>(
    query: string,
    variables?: Record<string, unknown>,
  ) => Promise<{ ok: true; data: T } | { ok: false; error: PartnerApiError }>;
};

export function makePartnerClient(input: {
  organizationId: string;
  accessToken: string;
}): PartnerClient {
  let lastRequestAt = 0;

  const endpoint = `https://partners.shopify.com/${encodeURIComponent(
    input.organizationId,
  )}/api/${API_VERSION}/graphql.json`;

  return {
    organizationId: input.organizationId,
    request: async (query, variables) => {
      // Sequential client-side throttle. Concurrent calls aren't expected
      // here — sync runs one cursor page at a time.
      const sinceLast = Date.now() - lastRequestAt;
      if (sinceLast < RATE_LIMIT_DELAY_MS) {
        await sleep(RATE_LIMIT_DELAY_MS - sinceLast);
      }
      lastRequestAt = Date.now();

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": input.accessToken,
            Accept: "application/json",
          },
          body: JSON.stringify({ query, variables: variables ?? {} }),
          cache: "no-store",
        });
        clearTimeout(timer);

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          return {
            ok: false,
            error: {
              kind: "http_error",
              status: res.status,
              message: body.slice(0, 300) || res.statusText,
            },
          };
        }

        const json = (await res.json()) as GraphqlResponse<unknown>;
        if (json.errors && json.errors.length > 0) {
          return {
            ok: false,
            error: {
              kind: "graphql_error",
              messages: json.errors.map((e) => e.message),
            },
          };
        }
        if (json.data == null) {
          return {
            ok: false,
            error: {
              kind: "graphql_error",
              messages: ["GraphQL response had no `data` field."],
            },
          };
        }
        return { ok: true, data: json.data as never };
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof Error && err.name === "AbortError") {
          return { ok: false, error: { kind: "timeout" } };
        }
        return {
          ok: false,
          error: {
            kind: "network",
            message: err instanceof Error ? err.message : "Unknown network error",
          },
        };
      }
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Query helpers ───────────────────────────────────────────────────

const QUERY_APP_BY_ID = /* GraphQL */ `
  query AppById($id: ID!) {
    app(id: $id) {
      id
      name
      apiKey
    }
  }
`;

export type PartnerAppInfo = {
  id: string;
  name: string;
  apiKey: string | null;
  handle: string | null;
};

export async function fetchAppById(
  client: PartnerClient,
  appGid: string,
): Promise<
  | { ok: true; data: PartnerAppInfo }
  | { ok: false; error: PartnerApiError | { kind: "not_found" } }
> {
  const res = await client.request<{
    app: { id: string; name: string; apiKey: string | null } | null;
  }>(QUERY_APP_BY_ID, { id: appGid });
  if (!res.ok) return res;
  if (!res.data.app) {
    return { ok: false, error: { kind: "not_found" } };
  }
  return {
    ok: true,
    data: {
      id: res.data.app.id,
      name: res.data.app.name,
      apiKey: res.data.app.apiKey,
      handle: null,
    },
  };
}

const QUERY_APP_EVENTS = /* GraphQL */ `
  query AppEvents(
    $appId: ID!
    $first: Int = 100
    $after: String
    $occurredAtMin: DateTime
    $occurredAtMax: DateTime
  ) {
    app(id: $appId) {
      id
      name
      events(
        first: $first
        after: $after
        occurredAtMin: $occurredAtMin
        occurredAtMax: $occurredAtMax
      ) {
        edges {
          cursor
          node {
            __typename
            occurredAt
            shop {
              id
              name
              myshopifyDomain
            }
            ... on SubscriptionChargeAccepted {
              charge { amount { amount currencyCode } name test }
            }
            ... on SubscriptionChargeActivated {
              charge { amount { amount currencyCode } name test }
            }
            ... on SubscriptionChargeCanceled {
              charge { amount { amount currencyCode } name test }
            }
            ... on SubscriptionChargeFrozen {
              charge { amount { amount currencyCode } name test }
            }
            ... on SubscriptionChargeUnfrozen {
              charge { amount { amount currencyCode } name test }
            }
            ... on OneTimeChargeAccepted {
              charge { amount { amount currencyCode } name test }
            }
            ... on OneTimeChargeActivated {
              charge { amount { amount currencyCode } name test }
            }
            ... on UsageChargeApplied {
              charge { amount { amount currencyCode } name test }
            }
            ... on CreditApplied {
              appCredit { amount { amount currencyCode } name test }
            }
          }
        }
        pageInfo {
          hasNextPage
        }
      }
    }
  }
`;

export type PartnerAppEvent = {
  type: string;
  occurredAt: string;
  shopGid: string;
  shopName: string | null;
  shopDomain: string | null;
  shopEmail: string | null;
  shopOwner: string | null;
  chargeAmount: string | null;
  chargeCurrency: string | null;
  chargeName: string | null;
  isTest: boolean;
};

type ChargeFragment = {
  amount?: { amount?: string; currencyCode?: string };
  name?: string;
  test?: boolean;
};

type AppEventsPage = {
  edges: Array<{
    cursor: string;
    node: {
      __typename: string;
      occurredAt: string;
      shop: {
        id: string;
        name: string | null;
        myshopifyDomain: string | null;
        contactEmail?: string | null;
        shopOwner?: string | null;
      } | null;
      charge?: ChargeFragment;
      appCredit?: ChargeFragment;
    };
  }>;
  pageInfo: { hasNextPage: boolean };
};

/**
 * Fetch ONE page of events for an app. Caller drives pagination via the
 * returned `nextCursor` (when `hasNextPage` is true).
 */
export async function fetchAppEventsPage(
  client: PartnerClient,
  input: {
    appGid: string;
    after?: string;
    first?: number;
    occurredAtMin?: Date;
    occurredAtMax?: Date;
  },
): Promise<
  | {
      ok: true;
      data: {
        events: PartnerAppEvent[];
        hasNextPage: boolean;
        nextCursor: string | null;
      };
    }
  | { ok: false; error: PartnerApiError | { kind: "not_found" } }
> {
  const variables: Record<string, unknown> = {
    appId: input.appGid,
    first: input.first ?? 100,
  };
  if (input.after) variables.after = input.after;
  if (input.occurredAtMin)
    variables.occurredAtMin = input.occurredAtMin.toISOString();
  if (input.occurredAtMax)
    variables.occurredAtMax = input.occurredAtMax.toISOString();

  const res = await client.request<{
    app: { id: string; events: AppEventsPage } | null;
  }>(QUERY_APP_EVENTS, variables);
  if (!res.ok) return res;
  if (!res.data.app) return { ok: false, error: { kind: "not_found" } };

  const page = res.data.app.events;
  const events: PartnerAppEvent[] = page.edges.flatMap((edge) => {
    const n = edge.node;
    if (!n.shop) return [];
    // Extract charge from whichever fragment matched (charge or appCredit).
    const c = n.charge ?? n.appCredit ?? null;
    return [
      {
        type: n.__typename,
        occurredAt: n.occurredAt,
        shopGid: n.shop.id,
        shopName: n.shop.name,
        shopDomain: n.shop.myshopifyDomain,
        shopEmail: n.shop.contactEmail ?? null,
        shopOwner: n.shop.shopOwner ?? null,
        chargeAmount: c?.amount?.amount ?? null,
        chargeCurrency: c?.amount?.currencyCode ?? null,
        chargeName: c?.name ?? null,
        isTest: c?.test ?? false,
      },
    ];
  });

  const lastCursor = page.edges[page.edges.length - 1]?.cursor ?? null;
  return {
    ok: true,
    data: {
      events,
      hasNextPage: page.pageInfo.hasNextPage,
      nextCursor: page.pageInfo.hasNextPage ? lastCursor : null,
    },
  };
}

/**
 * Convenience: walk all pages until `hasNextPage` is false. Caps total
 * pages to avoid runaway requests when something goes wrong.
 */
export async function fetchAllAppEvents(
  client: PartnerClient,
  input: {
    appGid: string;
    occurredAtMin?: Date;
    occurredAtMax?: Date;
    /** Hard cap on pages — default 100 = up to 10 000 events. */
    maxPages?: number;
  },
): Promise<
  | { ok: true; data: { events: PartnerAppEvent[]; pages: number } }
  | { ok: false; error: PartnerApiError | { kind: "not_found" } }
> {
  const maxPages = input.maxPages ?? 100;
  const all: PartnerAppEvent[] = [];
  let cursor: string | undefined;
  let pages = 0;

  while (pages < maxPages) {
    const res = await fetchAppEventsPage(client, {
      appGid: input.appGid,
      after: cursor,
      first: 100,
      occurredAtMin: input.occurredAtMin,
      occurredAtMax: input.occurredAtMax,
    });
    if (!res.ok) return res;
    all.push(...res.data.events);
    pages++;
    if (!res.data.hasNextPage || !res.data.nextCursor) break;
    cursor = res.data.nextCursor;
  }

  return { ok: true, data: { events: all, pages } };
}
