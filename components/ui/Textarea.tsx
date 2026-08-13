import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  textareaClassName?: string;
  error?: boolean;
  helperText?: React.ReactNode;
}

export function Textarea({
  label,
  id,
  style,
  className = '',
  textareaClassName = '',
  error = false,
  helperText,
  ...props
}: TextareaProps) {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`form-field ${className}`.trim()} style={style}>
      {label ? (
        <label htmlFor={textareaId} className="form-label">
          {label}
        </label>
      ) : null}
      <textarea
        id={textareaId}
        className={`form-input ${error ? 'form-input-error' : ''} ${textareaClassName}`.trim()}
        {...props}
      />
      {helperText ? (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          {helperText}
        </div>
      ) : null}
    </div>
  );
}
