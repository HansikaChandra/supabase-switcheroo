import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const KampusApp = lazy(() => import("@/kampus/App"));

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Kampus.VC — A creative marketplace for the AI era" },
      {
        name: "description",
        content:
          "Meet AI creators, explore extraordinary work, and bring your brand campaigns to life with people who know how to make it matter.",
      },
      { property: "og:title", content: "Kampus.VC — A creative marketplace for the AI era" },
      {
        property: "og:description",
        content:
          "Meet AI creators, explore extraordinary work, and bring your brand campaigns to life.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly fallback={null}>
      <Suspense fallback={null}>
        <KampusApp />
      </Suspense>
    </ClientOnly>
  );
}
