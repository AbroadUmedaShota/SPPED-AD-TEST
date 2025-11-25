

import React, { ChangeEvent } from 'react';

interface FormFieldProps {
  id: string;
  label: string;
  type?: 'text' | 'email' | 'date' | 'time';
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  error?: string;
  as?: 'input' | 'textarea' | 'select';
  options?: { value: string; label: string; disabled?: boolean }[];
  rows?: number;
}

const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  type = 'text',
  value,
  onChange,
  required = false,
  placeholder = '',
  hint,
  error,
  as = 'input',
  options = [],
  rows = 3,
}) => {
  const commonProps = {
    id,
    name: id,
    value,
    onChange,
    placeholder,
    className: `mt-1 block w-full px-3 py-2 bg-white border ${
      error ? 'border-red-500' : 'border-slate-300'
    } rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-1 ${
      error ? 'focus:ring-red-500 focus:border-red-500' : 'focus:ring-blue-500 focus:border-blue-500'
    } disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 disabled:shadow-none`,
  };

  const renderInput = () => {
    switch (as) {
      case 'textarea':
        return (
          <textarea
            {...commonProps}
            rows={rows}
          />
        );
      case 'select':
        return (
          <select {...commonProps}>
            <option value="">{placeholder || '選択してください...'}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
        );
      case 'input':
      default:
        return <input {...commonProps} type={type} />;
    }
  };

  return (
    <div className="mb-6">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {renderInput()}
      {hint && !error && <p className="mt-2 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default FormField;