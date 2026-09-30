import React, { useEffect, useState } from "react";
import {
  roomInventoryApi,
  AccommodationOption,
} from "../services/roomInventoryApi";
import { authService } from "../services/authService";
export default function AccommodationSettings() {
  const [options, setOptions] = useState<AccommodationOption[]>([]);
  const [savedKeys, setSavedKeys] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const admin = authService.getUser()?.role === "admin";
  useEffect(() => {
    let active = true;
    roomInventoryApi
      .options()
      .then((result) => {
        if (active) {
          setOptions(result.data);
          setSavedKeys(result.data.map((o: AccommodationOption) => o.key));
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setError("Could not load accommodation options.");
      });
    return () => {
      active = false;
    };
  }, []);
  const change = (index: number, update: Partial<AccommodationOption>) => {
    setOptions((current) =>
      current.map((option, i) =>
        i === index ? { ...option, ...update } : option,
      ),
    );
    setMessage("");
  };
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await roomInventoryApi.saveOptions(options);
      setOptions(result.data);
      setSavedKeys(result.data.map((o: AccommodationOption) => o.key));
      setMessage(
        "Accommodation options saved. Existing agreements keep their prices.",
      );
    } catch (e: any) {
      setError(
        e.response?.data?.message || "Could not save accommodation options.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-4">
      <h3 className="text-xl font-semibold">Accommodation options</h3>
      <p>
        Configure what clients can request and purchase. Physical bedrooms are
        configured under Houses. Add a new option to change occupancy or
        bathroom requirements on an existing category. Prices below are signed
        adjustments to the base retreat price; negative amounts are discounts.
      </p>
      <fieldset disabled={!admin || !loaded || busy} className="space-y-4">
        {options.map((option, index) => (
          <div key={index} className="rounded border bg-white p-4 space-y-3">
            <label>
              Stable key
              <input
                aria-label={`Option ${index + 1} key`}
                readOnly={savedKeys.includes(option.key)}
                value={option.key}
                onChange={(e) => change(index, { key: e.target.value })}
                className="block border rounded p-2"
              />
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              {(["en", "cs", "pl"] as const).map((language) => (
                <label key={language}>
                  Label ({language})
                  <input
                    aria-label={`${option.key} ${language} label`}
                    className="block w-full border rounded p-2"
                    value={option.labels[language]}
                    onChange={(e) =>
                      change(index, {
                        labels: {
                          ...option.labels,
                          [language]: e.target.value,
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-4">
              <label>
                Occupancy
                <select
                  aria-label={`${option.key} occupancy`}
                  className="block border rounded p-2"
                  disabled={savedKeys.includes(option.key)}
                  value={option.occupancy}
                  onChange={(e) =>
                    change(index, { occupancy: e.target.value as any })
                  }
                >
                  <option value="shared">Shared room</option>
                  <option value="private">Exclusive room</option>
                </select>
              </label>
              <label>
                Bathroom
                <select
                  className="block border rounded p-2"
                  disabled={savedKeys.includes(option.key)}
                  value={option.bathroom}
                  onChange={(e) =>
                    change(index, { bathroom: e.target.value as any })
                  }
                >
                  <option value="any">Shared bathroom acceptable</option>
                  <option value="private">Private bathroom required</option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={option.active}
                  onChange={(e) => change(index, { active: e.target.checked })}
                />{" "}
                Available for new choices
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              {["EUR", "USD", "CZK", "PLN"].map((currency) => (
                <label key={currency}>
                  Adjustment {currency}
                  <input
                    type="number"
                    step="0.01"
                    className="block w-full border rounded p-2"
                    value={option.prices[currency] ?? ""}
                    onChange={(e) => {
                      const prices = { ...option.prices };
                      if (e.target.value === "") delete prices[currency];
                      else prices[currency] = Number(e.target.value);
                      change(index, { prices });
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
        <button
          type="button"
          className="rounded border px-3 py-2"
          onClick={() =>
            setOptions([
              ...options,
              {
                key: "",
                labels: { en: "", cs: "", pl: "" },
                occupancy: "shared",
                bathroom: "any",
                active: true,
                prices: {},
              },
            ])
          }
        >
          Add accommodation option
        </button>{" "}
        <button
          type="button"
          className="rounded bg-teal-700 text-white px-4 py-2"
          onClick={save}
        >
          Save accommodation options
        </button>
      </fieldset>
      {!admin && <p>Only administrators can change these options.</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
