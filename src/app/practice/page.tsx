"use client";

import { Suspense } from "react";
import { Quiz } from "@/components/Quiz";

// useSearchParams requires a Suspense boundary under static export.
export default function PracticePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      }
    >
      <Quiz />
    </Suspense>
  );
}
