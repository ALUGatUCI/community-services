import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="w-full border-b border-border bg-surface">
      <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
        <Link
          href="/"
          className="font-semibold tracking-tight text-foreground no-underline"
        >
          ALUG@UCI Community Services
        </Link>
      </div>
    </header>
  );
}
