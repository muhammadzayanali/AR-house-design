"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/providers/AuthProvider";

export function SiteHeader() {
  const pathname = usePathname();
  const { user, logout, ready } = useAuth();

  if (pathname === "/ar") return null;

  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-serif text-xl tracking-tight">
          Plotline
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/ar" className="hover:text-brass">
            Measure
          </Link>
          <Link href="/dashboard" className="hover:text-brass">
            Projects
          </Link>
          {ready && user ? (
            <>
              <span className="hidden text-muted sm:inline">{user.username}</span>
              <button type="button" onClick={() => void logout()} className="hover:text-brass">
                Log out
              </button>
            </>
          ) : (
            <Link href="/login" className="hover:text-brass">
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
