import { useState } from 'react';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Input } from '@/components/ui/Input';
import { CALLING_CODES, DEFAULT_CALLING_CODE_ISO2 } from '@/lib/callingCodes';

interface PhoneInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
}

const DIAL_CODE_OPTIONS = CALLING_CODES.map((code) => ({
  value: code.iso2,
  label: code.dialCode,
  description: code.country,
}));

/** Longest dial code first, so "+1" doesn't shadow "+1xxx"-style matches. */
const CODES_BY_LENGTH_DESC = [...CALLING_CODES].sort((a, b) => b.dialCode.length - a.dialCode.length);

function composePhone(iso2: string, national: string): string {
  const trimmed = national.trim();
  if (!trimmed) return '';
  const dialCode = CALLING_CODES.find((code) => code.iso2 === iso2)?.dialCode ?? '';
  return `${dialCode} ${trimmed}`;
}

function parsePhone(value: string): { iso2: string; national: string } {
  const trimmed = value.trim();
  if (!trimmed.startsWith('+')) {
    return { iso2: DEFAULT_CALLING_CODE_ISO2, national: trimmed };
  }

  const match = CODES_BY_LENGTH_DESC.find((code) => trimmed.startsWith(code.dialCode));
  if (!match) {
    return { iso2: DEFAULT_CALLING_CODE_ISO2, national: trimmed };
  }

  return { iso2: match.iso2, national: trimmed.slice(match.dialCode.length).trim() };
}

/**
 * A country-code picker + national number field that compose to a single
 * stored string (e.g. "+234 8031234567"), so it drops into any existing
 * plain-text phone column with no backend change. Dial codes shared by more
 * than one country (+1 is US, Canada, and several Caribbean nations) can't
 * be round-tripped to the exact original country on re-edit — only the
 * picker's label is affected, never the stored value.
 */
export function PhoneInput({ id, value, onChange, placeholder = 'Phone number', invalid, disabled }: PhoneInputProps) {
  const [dialIso2, setDialIso2] = useState(() => parsePhone(value).iso2);
  const [national, setNational] = useState(() => parsePhone(value).national);

  return (
    <div className="flex gap-2">
      <SelectMenu
        className="w-32 flex-shrink-0"
        value={dialIso2}
        onChange={(iso2) => {
          setDialIso2(iso2);
          onChange(composePhone(iso2, national));
        }}
        options={DIAL_CODE_OPTIONS}
        invalid={invalid}
        disabled={disabled}
      />
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        value={national}
        onChange={(event) => {
          setNational(event.target.value);
          onChange(composePhone(dialIso2, event.target.value));
        }}
        placeholder={placeholder}
        invalid={invalid}
        disabled={disabled}
        className="flex-1"
      />
    </div>
  );
}
