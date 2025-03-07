'use client';

import { FC, useState, useEffect, useRef } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CountrySelectValue } from '@/components/ui/country-select';
import countries from 'world-countries';

// Define region mappings
export interface RegionOption {
  value: string;
  label: string;
  countries: string[]; // Array of country codes (cca2)
}

// Define regions with their member countries
export const regions: RegionOption[] = [
  { 
    value: 'eu', 
    label: 'European Union', 
    countries: ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']
  },
  { 
    value: 'europe', 
    label: 'Europe', 
    countries: ['AL', 'AD', 'AM', 'AT', 'AZ', 'BY', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'GE', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'KZ', 'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'MC', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'RU', 'SM', 'RS', 'SK', 'SI', 'ES', 'SE', 'CH', 'TR', 'UA', 'GB', 'VA']
  },
  { 
    value: 'na', 
    label: 'North America', 
    countries: ['CA', 'US', 'MX', 'GT', 'BZ', 'SV', 'HN', 'NI', 'CR', 'PA']
  },
  { 
    value: 'sa', 
    label: 'South America', 
    countries: ['AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'GY', 'PY', 'PE', 'SR', 'UY', 'VE']
  },
  { 
    value: 'as', 
    label: 'Asia', 
    countries: ['AF', 'AM', 'AZ', 'BH', 'BD', 'BT', 'BN', 'KH', 'CN', 'CY', 'GE', 'IN', 'ID', 'IR', 'IQ', 'IL', 'JP', 'JO', 'KZ', 'KW', 'KG', 'LA', 'LB', 'MY', 'MV', 'MN', 'MM', 'NP', 'KP', 'OM', 'PK', 'PS', 'PH', 'QA', 'SA', 'SG', 'KR', 'LK', 'SY', 'TW', 'TJ', 'TH', 'TL', 'TR', 'TM', 'AE', 'UZ', 'VN', 'YE']
  },
  { 
    value: 'af', 
    label: 'Africa', 
    countries: ['DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'CF', 'TD', 'KM', 'CD', 'CG', 'CI', 'DJ', 'EG', 'GQ', 'ER', 'SZ', 'ET', 'GA', 'GM', 'GH', 'GN', 'GW', 'KE', 'LS', 'LR', 'LY', 'MG', 'MW', 'ML', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG', 'RW', 'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'TZ', 'TG', 'TN', 'UG', 'ZM', 'ZW']
  },
  { 
    value: 'oc', 
    label: 'Oceania', 
    countries: ['AU', 'FJ', 'KI', 'MH', 'FM', 'NR', 'NZ', 'PW', 'PG', 'WS', 'SB', 'TO', 'TV', 'VU']
  }
];

interface RegionSelectProps {
  value: string | undefined;
  onChange: (value: string | undefined, countries: CountrySelectValue[] | undefined) => void;
}

const RegionSelect: FC<RegionSelectProps> = ({ value, onChange }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  // Get all country options from world-countries
  const countryOptions = countries.map((country) => ({
    value: country.cca2,
    label: country.name.common,
    flag: country.flag,
  }));

  // Handle region selection
  const handleRegionChange = (regionValue: string) => {
    if (!regionValue || regionValue === '__all__') {
      onChange(undefined, undefined);
      return;
    }

    // Find the selected region
    const selectedRegion = regions.find(region => region.value === regionValue);
    if (!selectedRegion) {
      console.error(`Region not found: ${regionValue}`);
      return;
    }

    // Get all countries in this region
    const regionCountries = selectedRegion.countries;
    
    // Map country codes to CountrySelectValue objects
    const selectedCountries = regionCountries
      .map(code => countryOptions.find(country => country.value === code))
      .filter(country => country !== undefined) as CountrySelectValue[];

    // Call onChange with both the region value and the selected countries
    onChange(regionValue, selectedCountries);
  };

  return (
    <Select
      value={value || ''}
      onValueChange={handleRegionChange}
    >
      <SelectTrigger>
        <SelectValue placeholder="All Regions" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All Regions</SelectItem>
        {regions.map((region) => (
          <SelectItem key={region.value} value={region.value}>
            {region.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default RegionSelect;
