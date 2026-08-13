import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  selectClassName?: string;
  error?: boolean;
  helperText?: React.ReactNode;
  children?: React.ReactNode;
}

export function Select({
  label,
  id,
  style,
  className = '',
  selectClassName = '',
  error = false,
  helperText,
  children,
  ...props
}: SelectProps) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`form-field ${className}`.trim()} style={style}>
      {label ? (
        <label htmlFor={selectId} className="form-label">
          {label}
        </label>
      ) : null}
      <select
        id={selectId}
        className={`form-input ${error ? 'form-input-error' : ''} ${selectClassName}`.trim()}
        {...props}
      >
        {children}
      </select>
      {helperText ? (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          {helperText}
        </div>
      ) : null}
    </div>
  );
}
