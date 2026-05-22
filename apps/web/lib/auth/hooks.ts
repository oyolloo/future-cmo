"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import type { LoginInput } from "@/app/(auth)/sign-in/_lib/schema";
import type { RegisterInput } from "@/app/(auth)/sign-up/_lib/schema";
import type { PublicUser } from "@/lib/auth/session";

export const authQueryKeys = {
  all: ["auth"] as const,
  currentUser: ["auth", "currentUser"] as const,
};

type AuthErrorBody = {
  error?: { code?: string; message?: string };
};

async function readError(res: Response): Promise<Error> {
  let body: AuthErrorBody = {};
  try {
    body = (await res.json()) as AuthErrorBody;
  } catch {
    // body wasn't JSON — fall through
  }
  return new Error(body.error?.message ?? `Request failed (${res.status})`);
}

export function useCurrentUser() {
  return useQuery<PublicUser | null>({
    queryKey: authQueryKeys.currentUser,
    queryFn: async () => {
      const res = await fetch("/api/auth/me", {
        credentials: "include",
      });
      if (res.status === 401) return null;
      if (!res.ok) throw await readError(res);
      const data = (await res.json()) as { user: PublicUser };
      return data.user;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<PublicUser, Error, RegisterInput>({
    mutationFn: async (input) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      if (!res.ok) throw await readError(res);
      const data = (await res.json()) as { user: PublicUser };
      return data.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(authQueryKeys.currentUser, user);
      queryClient.invalidateQueries({ queryKey: authQueryKeys.all });
      router.push("/dashboard");
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<PublicUser, Error, LoginInput>({
    mutationFn: async (input) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      if (!res.ok) throw await readError(res);
      const data = (await res.json()) as { user: PublicUser };
      return data.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(authQueryKeys.currentUser, user);
      queryClient.invalidateQueries({ queryKey: authQueryKeys.all });
      router.push("/dashboard");
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw await readError(res);
    },
    onSuccess: () => {
      queryClient.clear();
      router.push("/sign-in");
    },
  });
}
