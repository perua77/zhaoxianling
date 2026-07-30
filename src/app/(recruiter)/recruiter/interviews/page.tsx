"use client";

import { Suspense } from "react";
import { InterviewsPageContent } from "@/components/recruiter/interviews-management";

export default function InterviewsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20">加载中...</div>}>
      <InterviewsPageContent />
    </Suspense>
  );
}