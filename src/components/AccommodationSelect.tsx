import React, { useEffect, useState } from "react";
import {
  AccommodationOption,
  roomInventoryApi,
} from "../services/roomInventoryApi";
export default function AccommodationSelect({
  value,
  clientId,
  onChange,
  disabled = false,
  required = false,
  preference = false,
  offeredOptions,
  optionDescriptions,
}: {
  value?: string;
  clientId?: string;
  onChange: (key: string, legacy: string) => void;
  disabled?: boolean;
  required?: boolean;
  preference?: boolean;
  offeredOptions?: AccommodationOption[];
  optionDescriptions?: Record<string, string>;
}) {
  const [options, setOptions] = useState<AccommodationOption[]>([]);
  const [suggested, setSuggested] = useState<{
    key: string;
    label: string;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (offeredOptions) {
      return;
    }
    roomInventoryApi
      .options()
      .then((r) => {
        if (active) setOptions(r.data);
      })
      .catch(() => {
        if (active) setError("Unable to load accommodation options.");
      });
    return () => {
      active = false;
    };
  }, [offeredOptions]);
  useEffect(() => {
    let active = true;
    setSuggested(null);
    if (clientId)
      roomInventoryApi
        .preference(clientId)
        .then((r) => {
          if (active) setSuggested(r.data);
        })
        .catch(() => {
          if (active) setError("Unable to load screening preference.");
        });
    return () => {
      active = false;
    };
  }, [clientId]);
  const selected = value === undefined ? suggested?.key || "" : value;
  const displayedOptions = offeredOptions || options;
  const missing =
    selected &&
    !displayedOptions.some(
      (option) => option.key === selected && option.active,
    );
  return (
    <label className="block text-sm font-medium text-gray-700">
      {preference ? "Desired accommodation" : "Accommodation"}{required ? " *" : ""}
      <select
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        required={required}
        value={selected}
        disabled={disabled}
        onChange={(event) => {
          const option = displayedOptions.find(
            (item) => item.key === event.target.value,
          );
          onChange(event.target.value, option?.legacyRoomType || "unspecified");
        }}
      >
        <option value="">{required ? "Choose Shared or Private" : "Not decided"}</option>
        {displayedOptions
          .filter((option) => option.active)
          .map((option) => (
            <option key={option.key} value={option.key}>
              {option.labels.en}
              {optionDescriptions?.[option.key]
                ? ` — ${optionDescriptions[option.key]}`
                : ""}
            </option>
          ))}
        {missing && (
          <option value={selected}>
            {suggested?.key === selected ? suggested.label : selected}{" "}
            (unavailable)
          </option>
        )}
      </select>
      {value === undefined && suggested?.key && (
        <small>
          From screening: {suggested.label}. Preference only; availability must
          be confirmed.
        </small>
      )}
      {missing && (
        <small className="block text-amber-700">
          Choose an active option before creating a new agreement.
        </small>
      )}
      {preference && <small>A preference does not reserve a room.</small>}
      {error && <small role="alert">{error}</small>}
    </label>
  );
}
