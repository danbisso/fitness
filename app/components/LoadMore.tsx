import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";

export const PAGE = 20;

// How many list rows the current URL asks for (?count=, bumped by the sentinel).
export function pageCount(request: Request) {
  const n = Number(new URL(request.url).searchParams.get("count"));
  return Number.isFinite(n) && n > PAGE ? Math.floor(n) : PAGE;
}

// Infinite scroll: render this after a paginated list. When it scrolls near
// the viewport it bumps ?count=, which re-runs the loader with a bigger page.
// URL-driven so mutations/revalidation always show a consistent list.
export function LoadMoreSentinel({ hasMore, loaded }: { hasMore: boolean; loaded: number }) {
  const [, setSearchParams] = useSearchParams();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!hasMore || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSearchParams(
            (prev) => {
              prev.set("count", String(loaded + PAGE));
              return prev;
            },
            { replace: true, preventScrollReset: true },
          );
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loaded, setSearchParams]);

  if (!hasMore) return null;
  return (
    <div ref={ref} className="py-3 text-center text-sm text-muted-foreground">
      Loading more…
    </div>
  );
}
