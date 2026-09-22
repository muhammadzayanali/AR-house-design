"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { useAuth } from "@/components/providers/AuthProvider";
import { registerRequest } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await registerRequest(username, password, email);
      login(result.token, result.user);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <h1 className="font-serif text-3xl">Create account</h1>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-4">
        {error && <p className="text-sm text-red-700">{error}</p>}
        <label className="block text-sm">
          Username
          <input
            className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-3"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Email
          <input
            type="email"
            className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-3"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            minLength={6}
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-ink py-3 text-paper"
        >
          {busy ? "Creating…" : "Register"}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        Already registered?{" "}
        <Link href="/login" className="text-brass">
          Log in
        </Link>
      </p>
    </main>
  );
}
