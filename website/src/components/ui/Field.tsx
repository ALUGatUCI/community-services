import type { ReactNode } from "react";

type FieldProps = {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
};

// A labeled form row: label above the control, optional hint below.
export function Field({ label, htmlFor, hint, children }: FieldProps) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
    </div>
  );
}
