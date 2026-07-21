import { loginRequestSchema, type LoginRequest } from "@rms/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@rms/ui";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { apiClient } from "../lib/api";
import { useAuthStore } from "../lib/auth-store";

export function LoginPage() {
  const token = useAuthStore((s) => s.token);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();

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
      const redirectTo = (location.state as { from?: Location })?.from?.pathname ?? "/dashboard";
      navigate(redirectTo, { replace: true });
    },
    onError: () => {
      setError("password", { message: "Incorrect email or password." });
    },
  });

  if (token) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper-2 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-2xl text-ink">The Italian Bistro</p>
          <p className="mt-1 text-sm text-ink-3">Admin &amp; staff dashboard</p>
        </div>

        <form
          onSubmit={handleSubmit((body) => mutation.mutate(body))}
          className="space-y-4 rounded-lg border border-rule bg-paper p-6 shadow-md"
          noValidate
        >
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="h-11 w-full rounded-md border border-rule bg-paper px-3 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
              {...register("email")}
            />
            {errors.email && <p className="mt-1 text-sm text-danger">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="h-11 w-full rounded-md border border-rule bg-paper px-3 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
              {...register("password")}
            />
            {errors.password && <p className="mt-1 text-sm text-danger">{errors.password.message}</p>}
          </div>

          <Button type="submit" fullWidth loading={mutation.isPending}>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
