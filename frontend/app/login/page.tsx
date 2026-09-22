"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

import { useAuth } from "@/components/providers/AuthProvider";
import { loginRequest } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await loginRequest(username, password);
      login(result.token, result.user);
      router.push(params.get("next") || "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <h1 className="font-serif text-3xl">Log in</h1>
      <p className="mt-2 text-sm text-muted">
        Saving a project and generating an AI report requires an account.
      </p>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-4">
        {error && <p className="text-sm text-red-700">{error}</p>}
        <label className="block text-sm">
          Username or email
          <input
            className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-3"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="username or email"
            required
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            type="password"
            className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-ink py-3 text-paper"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        No account?{" "}
        <Link href="/register" className="text-brass">
          Register
        </Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
