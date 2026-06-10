/**
 * OyoPass SDK for Next.js Apps
 *
 * Usage:
 *
 * 1. Copy the `src/sdk/` folder into your Next.js project (e.g. `lib/oyopass/`)
 *
 * 2. Create a config file:
 *    ```ts
 *    // lib/oyopass/config.ts
 *    import { createOyoPass } from "./index";
 *    export const oyopass = createOyoPass({
 *      issuer: process.env.OYOPASS_ISSUER!,
 *      clientId: process.env.OYOPASS_CLIENT_ID!,
 *      clientSecret: process.env.OYOPASS_CLIENT_SECRET!,
 *      appUrl: process.env.APP_URL || "http://localhost:3000",
 *      callbackPath: "/api/auth/oyopass/callback",  // default
 *      onSuccess: async (profile, tokens) => {
 *        // Your logic: upsert user, create session, set cookie
 *        // Return the URL to redirect to after login
 *        return "/dashboard";
 *      },
 *    });
 *    ```
 *
 * 3. Create two API route files:
 *    ```ts
 *    // app/api/auth/oyopass/route.ts
 *    export { GET } from "@/lib/oyopass/config";
 *    // (just re-export — the SDK handles everything)
 *    ```
 *    Nope — use the handlers:
 *    ```ts
 *    // app/api/auth/oyopass/route.ts
 *    import { oyopass } from "@/lib/oyopass/config";
 *    export const GET = oyopass.initiateHandler;
 *    ```
 *    ```ts
 *    // app/api/auth/oyopass/callback/route.ts
 *    import { oyopass } from "@/lib/oyopass/config";
 *    export const GET = oyopass.callbackHandler;
 *    ```
 *
 * 4. Add the button component to your sign-in page:
 *    ```tsx
 *    import { OyoPassButton } from "@/lib/oyopass/button";
 *    // ...
 *    <OyoPassButton />
 *    ```
 */

export { createOyoPass, type OyoPassConfig, type OyoPassProfile, type OyoPassTokens } from "./client";
export { OyoPassButton } from "./button";
