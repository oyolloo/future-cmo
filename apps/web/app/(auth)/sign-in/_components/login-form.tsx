"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@kit/ui/button";
import { Checkbox } from "@kit/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@kit/ui/form";
import { Input } from "@kit/ui/input";

import { useLogin } from "@/lib/auth/hooks";

import { loginSchema, type LoginInput } from "../_lib/schema";

const defaultValues: LoginInput = {
  email: "",
  password: "",
  rememberMe: false,
};

export function LoginForm() {
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues,
    mode: "onBlur",
  });

  const login = useLogin();

  const onSubmit = form.handleSubmit((values) => {
    login.mutate(values);
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="rememberMe"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(value) => field.onChange(value === true)}
                />
              </FormControl>
              <FormLabel className="!mt-0 cursor-pointer font-normal">
                Remember me
              </FormLabel>
            </FormItem>
          )}
        />

        {login.error ? (
          <p className="text-sm text-destructive" role="alert">
            {login.error.message}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </Form>
  );
}
