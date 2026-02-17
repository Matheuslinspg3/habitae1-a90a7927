export function PropertyCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden border border-border/50 bg-card">
      <div className="aspect-[16/10] w-full skeleton-elegant" />
      <div className="p-4 space-y-3">
        <div className="h-5 w-3/4 skeleton-elegant" />
        <div className="h-4 w-1/2 skeleton-elegant" />
        <div className="flex gap-4">
          <div className="h-4 w-16 skeleton-elegant" />
          <div className="h-4 w-16 skeleton-elegant" />
          <div className="h-4 w-16 skeleton-elegant" />
        </div>
      </div>
    </div>
  );
}