import type { ReactNode } from "react";

type PageProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

// A consistent titled page container: centered column, header row with title
// (and optional actions), then content.
export function Page({ title, description, actions, children }: PageProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-1 text-muted">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
