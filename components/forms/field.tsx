import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FieldProps extends React.ComponentProps<typeof Input> {
  name: string;
  label: string;
  errors?: string[];
  hint?: string;
}

/** Label + input + error text, wired up with aria-invalid/aria-describedby. */
export function Field({ name, label, errors, hint, id, ...props }: FieldProps) {
  const inputId = id ?? `field-${name}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy =
    [errors?.length ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="grid gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        name={name}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {hint && (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
      {errors?.length ? (
        <p id={errorId} className="text-destructive text-sm">
          {errors.join(' ')}
        </p>
      ) : null}
    </div>
  );
}
