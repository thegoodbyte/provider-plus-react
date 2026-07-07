import React from 'react';
import {
  BOOKING_STEP_COLOR_PRESETS,
  getBookingStepDefaultColor,
  normalizeBookingStepColor,
} from '../utils/bookingStepColors';

type BookingStepColorFieldProps = {
  value: string;
  onChange: (value: string) => void;
  groupKey?: string;
  label?: string;
};

const BookingStepColorField: React.FC<BookingStepColorFieldProps> = ({
  value,
  onChange,
  groupKey,
  label = 'Section background color',
}) => {
  const activeColor = normalizeBookingStepColor(value) || getBookingStepDefaultColor(groupKey);

  return (
    <div className="block">
      <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">{label}</span>
      <div className="flex flex-wrap gap-2">
        {BOOKING_STEP_COLOR_PRESETS.map((preset) => {
          const isActive = normalizeBookingStepColor(value) === preset.value || (!normalizeBookingStepColor(value) && activeColor === preset.value);
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => onChange(preset.value)}
              className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                isActive ? 'border-gray-900 text-gray-900 shadow-sm' : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              <span
                className="h-3.5 w-3.5 rounded-full border border-gray-300"
                style={{ backgroundColor: preset.value }}
                aria-hidden="true"
              />
              {preset.label}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          type="color"
          value={activeColor}
          onChange={(e) => onChange(e.target.value)}
          className="h-[38px] w-12 rounded-md border border-gray-300 bg-white p-1"
          title="Choose a color"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder={getBookingStepDefaultColor(groupKey)}
        />
      </div>
    </div>
  );
};

export default BookingStepColorField;
