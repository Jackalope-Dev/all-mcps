import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  inputClassName?: string;
}

export function Input({ label, id, style, className = '', inputClassName = '', ...props }: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', ...style }} className={className}>
      {label && <label htmlFor={inputId} style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</label>}
      <input 
        id={inputId}
        className={`form-input ${inputClassName}`.trim()}
        {...props}
      />
    </div>
  );
}
