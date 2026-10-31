"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserFromStorage } from "@/lib/auth";

export default function RootPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const user = getUserFromStorage();
    if (user) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [router]);

  if (!mounted) return null;
  return null;
}
