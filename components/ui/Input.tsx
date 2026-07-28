import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  inputClassName?: string;
  error?: boolean;
}

export function Input({
  label,
  id,
  style,
  className = '',
  inputClassName = '',
  error = false,
  ...props
}: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

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
    </div>
  );
}
