import { z } from "zod";

export const loginSchema = z.object({
  /** Accepts either an email address or a username. */
  identifier: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;
