"use client";

import { RecruiterGuard } from "@/components/recruiter-guard";
import RecruiterSidebar from "@/components/recruiter-sidebar";

export default function RecruiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RecruiterGuard>
      <RecruiterSidebar />
      <main className="ml-[240px] min-h-screen bg-[#F9FAFB] p-6">
        {children}
      </main>
    </RecruiterGuard>
  );
}