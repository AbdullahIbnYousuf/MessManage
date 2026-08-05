import Link from "next/link";
import type { NavigationItem } from "@/components/navigation/config";
import NavIcon from "@/components/navigation/NavIcon";

export default function NavigationGroup({
  label,
  items,
  activeId,
}: {
  label: string;
  items: readonly NavigationItem[];
  activeId: NavigationItem["id"] | null;
}) {
  if (items.length === 0) return null;

  return (
    <div className="navigation-group">
      <div className="navigation-group__label">{label}</div>
      <div className="navigation-group__links">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`navigation-link ${active ? "active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="navigation-link__icon"><NavIcon name={item.icon} /></span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

