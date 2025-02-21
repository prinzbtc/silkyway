import { useState, useEffect } from 'react';
import Select from 'react-select';
import countries from 'world-countries';

// Add European Union
const EU = {
  name: {
    common: 'European Union',
  },
  cca2: 'EU',
  flag: '🇪🇺',
};

export type CountrySelectValue = {
  value: string;
  label: string;
  flag: string;
};

interface CountrySelectProps {
  value?: CountrySelectValue;
  onChange: (value: CountrySelectValue) => void;
}

export function CountrySelect({ value, onChange }: CountrySelectProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  const options = [
    // Add EU as the first option
    {
      value: EU.cca2,
      label: EU.name.common,
      flag: EU.flag,
    },
    // Add all countries
    ...countries.map((country) => ({
      value: country.cca2,
      label: country.name.common,
      flag: country.flag,
    })),
  ];

  return (
    <Select
      placeholder="Select your location..."
      options={options}
      value={value}
      onChange={(value) => onChange(value as CountrySelectValue)}
      isSearchable
      formatOptionLabel={(option: any) => (
        <div className="flex flex-row items-center gap-3">
          <div>{option.flag}</div>
          <div>{option.label}</div>
        </div>
      )}
      classNames={{
        control: () => 'p-2 border-2 dark:bg-[hsl(222.2,84%,4.9%)] dark:text-white',
        input: () => 'text-lg dark:text-white',
        option: () => 'text-lg dark:text-white',
        menu: () => 'dark:bg-[hsl(222.2,84%,4.9%)]',
        singleValue: () => 'dark:text-white',
      }}
      theme={(theme) => ({
        ...theme,
        borderRadius: 6,
        colors: {
          ...theme.colors,
          primary: 'black',
          primary25: '#ffe4e6',
          neutral0: 'var(--background)',  // Background color
          neutral80: 'var(--foreground)', // Text color
        },
      })}
    />
  );
}
