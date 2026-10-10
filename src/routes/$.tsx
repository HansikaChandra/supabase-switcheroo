import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const KampusApp = lazy(() => import("@/kampus/App"));

export const Route = createFileRoute("/$")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Kampus.VC" },
      {
        name: "description",
        content:
          "Kampus.VC is a two-sided marketplace for brands and agencies hiring AI creators.",
      },
      { property: "og:title", content: "Kampus.VC" },
      {
        property: "og:description",
        content:
          "Kampus.VC is a two-sided marketplace for brands and agencies hiring AI creators.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CatchAll,
});

function CatchAll() {
  return (
    <ClientOnly fallback={null}>
      <Suspense fallback={null}>
        <KampusApp />
      </Suspense>
    </ClientOnly>
  );
}
