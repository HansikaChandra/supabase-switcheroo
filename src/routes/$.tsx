import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { KampusApp } from "@/kampus/load-app";


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
