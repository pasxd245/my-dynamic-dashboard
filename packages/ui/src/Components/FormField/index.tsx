import type { ReactElement, ReactNode } from 'react';
import type { ZodIssue } from 'zod';

export interface FormFieldProps {
  readonly name: string;
  readonly label: string;
  readonly children: ReactElement;
  readonly issues?: ReadonlyArray<ZodIssue>;
  readonly required?: boolean;
  readonly help?: ReactNode;
}

/**
 * Labeled form-field wrapper. Surfaces the first ZodIssue whose
 * `path.join('.') === name` as an error message under the input.
 * No coupling to a specific form-state library — pair with
 * `@tanstack/react-form`, `react-hook-form`, or plain `useState`.
 */
export default function FormField({
  name,
  label,
  children,
  issues,
  required,
  help,
}: FormFieldProps): ReactElement {
  const issue = issues?.find((i) => i.path.join('.') === name);
  const message = issue?.message;
  const showHelp = !message && help != null;
  return (
    <div className="mdd-ui-form-field" data-field={name}>
      <label className="mdd-ui-form-field__label">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {message != null ? (
        <p className="mdd-ui-form-field__error" role="alert">
          {message}
        </p>
      ) : null}
      {showHelp ? <p className="mdd-ui-form-field__help">{help}</p> : null}
    </div>
  );
}

export { FormField };
