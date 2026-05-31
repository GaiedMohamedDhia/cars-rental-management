
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PaiementListPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/maintenance");
  }, [router]);
  return null;
}
