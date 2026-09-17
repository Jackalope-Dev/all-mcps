import type React from 'react';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  inputClassName?: string;
  error?: boolean;
  helperText?: React.ReactNode;
}

export function Input({
  label,
  id,
  style,
  className = '',
  inputClassName = '',
  error = false,
  helperText,
  ...props
}: InputProps) {
  const inputId =
    id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`form-field ${className}`.trim()} style={style}>
      {label ? (
        <label htmlFor={inputId} className="form-label">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={`form-input ${error ? 'form-input-error' : ''} ${inputClassName}`.trim()}
        {...props}
      />
      {helperText ? (
        <div
          style={{
            fontSize: '0.72rem',
            color: 'var(--text-secondary)',
            marginTop: '0.25rem',
          }}
        >
          {helperText}
        </div>
      ) : null}
    </div>
  );
}
