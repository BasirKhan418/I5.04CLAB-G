import { Eyes } from "@/components/brand";

export function LiveMarquee({
  items,
}: {
  items: string[];
}) {
  const row = items.length ? items : ["waiting for the first gate event"];
  const doubled = [...row, ...row];
  return (
    <div className="overflow-hidden border-b-2 border-ink bg-ink text-white">
      <div className="animate-marquee flex w-max gap-8 py-2 text-sm">
        {doubled.map((item, i) => (
          <span key={`${item}-${i}`} className="flex items-center gap-3 px-4">
            <Eyes />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
