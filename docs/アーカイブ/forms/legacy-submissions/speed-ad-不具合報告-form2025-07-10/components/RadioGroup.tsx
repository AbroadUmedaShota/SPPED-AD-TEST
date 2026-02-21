
import React from 'react';

interface RadioOption {
  value: string;
  label: string;
}

interface RadioGroupProps {
  legend: string;
  name: string;
  options: RadioOption[];
  selectedValue: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  error?: string;
}

const RadioGroup: React.FC<RadioGroupProps> = ({
  legend,
  name,
  options,
  selectedValue,
  onChange,
  required = false,
  error,
}) => {
  return (
    <fieldset className="mb-6">
      <legend className="block text-sm font-medium text-slate-700">
        {legend}
        {required && <span className="text-red-500 ml-1">*</span>}
      </legend>
      <div className="mt-2 space-y-2">
        {options.map((option) => (
          <div key={option.value} className="flex items-center">
            <input
              id={`${name}-${option.value}`}
              name={name}
              type="radio"
              value={option.value}
              checked={selectedValue === option.value}
              onChange={onChange}
              className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <label
              htmlFor={`${name}-${option.value}`}
              className="ml-3 block text-sm text-slate-700"
            >
              {option.label}
            </label>
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </fieldset>
  );
};

export default RadioGroup;
