import Link from "next/link";
import type { NavigationIconName } from "@/components/navigation/config";
import NavIcon from "@/components/navigation/NavIcon";

export default function HubCard({ href, title, description, icon }: { href: string; title: string; description: string; icon: NavigationIconName }) {
  return (
    <Link href={href} className="hub-card">
      <span className="hub-card__icon"><NavIcon name={icon} size={21} /></span>
      <span className="hub-card__body">
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <span className="hub-card__arrow" aria-hidden="true">→</span>
    </Link>
  );
}
