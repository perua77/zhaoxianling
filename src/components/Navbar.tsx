"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/hooks/useAuth";

export function Navbar() {
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/login";
  };

  return (
    <nav className="border-b bg-white">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold text-brand-green">
          招贤令
        </Link>

        <div className="flex gap-4 items-center">
          {user ? (
            <>
              <Link href="/my-applications">
                <Button variant="ghost">我的投递</Button>
              </Link>
              <Button variant="outline" onClick={handleLogout}>
                退出登录
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button className="bg-brand-green hover:bg-brand-green-dark">登录</Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}