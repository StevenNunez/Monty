import React from 'react';
import { cn } from '../lib/utils';

interface CurrencyInputProps {
  value: string;
  onChange: (raw: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  required?: boolean;
}

export default function CurrencyInput({ value, onChange, placeholder = '0', className, autoFocus, required }: CurrencyInputProps) {
  const display = value ? Number(value).toLocaleString('es-CL') : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    onChange(raw);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      autoFocus={autoFocus}
      required={required}
      placeholder={placeholder}
      className={cn(className)}
      value={display}
      onChange={handleChange}
    />
  );
}
