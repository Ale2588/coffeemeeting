import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

type FieldShellProps = {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
};

function FieldShell({ id, label, hint, error, children }: FieldShellProps) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, hint?: ReactNode, error?: ReactNode) {
  return [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
};

export function TextField({ label, hint, error, ...rest }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      />
    </FieldShell>
  );
}

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
};

export function SelectField({ label, hint, error, options, placeholder, ...rest }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode };

export function Checkbox({ label, ...rest }: CheckboxProps) {
  return (
    <label className="checkbox">
      <input type="checkbox" {...rest} />
      {label}
    </label>
  );
}
