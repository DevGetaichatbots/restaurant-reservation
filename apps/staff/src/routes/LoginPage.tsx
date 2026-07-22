import { loginRequestSchema, type LoginRequest } from "@rms/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@rms/ui";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";

import { apiClient } from "../lib/api";
import { useAuthStore } from "../lib/auth-store";

export function LoginPage() {
  const token = useAuthStore((s) => s.token);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginRequest>({ resolver: zodResolver(loginRequestSchema) });

  const mutation = useMutation({
    mutationFn: (body: LoginRequest) => apiClient.login(body),
    onSuccess: (data) => {
      login(data.token, data.user);
      navigate("/today", { replace: true });
    },
    onError: () => {
      setError("password", { message: "Incorrect email or password." });
    },
  });

  if (token) return <Navigate to="/today" replace />;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper-2 px-4">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <p className="font-display text-3xl text-ink">The Italian Bistro</p>
          <p className="mt-2 text-lg text-ink-3">Staff Sign In</p>
        </div>

        <form
          onSubmit={handleSubmit((body) => mutation.mutate(body))}
          className="space-y-5 rounded-xl border border-rule bg-paper p-8 shadow-lg"
          noValidate
        >
          <div>
            <label htmlFor="email" className="mb-2 block text-base font-medium text-ink-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="h-14 w-full rounded-lg border border-rule bg-paper px-4 text-lg text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
              {...register("email")}
            />
            {errors.email && <p className="mt-1.5 text-sm text-danger">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-base font-medium text-ink-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="h-14 w-full rounded-lg border border-rule bg-paper px-4 text-lg text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
              {...register("password")}
            />
            {errors.password && <p className="mt-1.5 text-sm text-danger">{errors.password.message}</p>}
          </div>

          <Button type="submit" fullWidth loading={mutation.isPending} size="lg">
            Sign in
          </Button>

          <p className="text-center text-sm text-ink-3">Session stays open all shift — no need to sign in again between tables.</p>
        </form>
      </div>
    </div>
  );
}
