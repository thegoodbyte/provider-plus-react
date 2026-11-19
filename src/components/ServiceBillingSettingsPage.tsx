import { BillingPartyFields } from './BillingPartyFields';
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { serviceRequestsApi } from "../services/api";
import AppleButton from "./AppleButton";
import AppleInput from "./AppleInput";
import { Card } from "./ui";

const selectClasses = "w-full p-2 border border-apple-gray-200 rounded-apple bg-white text-apple-gray-900 focus:outline-none focus:ring-2 focus:ring-apple-blue/20 focus:border-apple-blue";
const textareaClasses = "mt-1.5 w-full rounded-apple border border-apple-gray-200 bg-white px-4 py-2 text-apple-gray-900 transition-all duration-200 hover:border-apple-gray-300 focus:border-apple-blue focus:outline-none focus:ring-2 focus:ring-apple-blue/20 focus:ring-offset-1";
const labelClasses = "flex flex-col gap-1.5 text-sm font-medium text-apple-gray-700";

export default function ServiceBillingSettingsPage() {
  const [settings, setSettings] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    serviceRequestsApi
      .settings()
      .then((r) => setSettings(r.data))
      .catch((e) => setError(e.message));
  }, []);
  const config = settings?.configuration;
  const change = (section: string, index: number, key: string, value: any) =>
    setSettings((s: any) => ({
      ...s,
      configuration: {
        ...s.configuration,
        [section]: s.configuration[section].map((row: any, i: number) =>
          i === index ? { ...row, [key]: value } : row,
        ),
      },
    }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await serviceRequestsApi.saveSettings(settings);
      setSettings(r.data);
      setNotice(
        "Settings saved. Previously issued requests keep their original prices, terms and payment details.",
      );
    } catch (e: any) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="mx-auto max-w-[1040px] px-6 py-8 text-apple-gray-900">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <Link to="/admin/payment-requests/services/new" className="text-sm text-apple-blue hover:underline">
            ← New service request
          </Link>
          <h1 className="mt-2 text-[30px] font-bold tracking-tight">Service billing settings</h1>
          <p className="mt-2 text-apple-gray-500">
            Configure your catalog, policy templates and payment recipients.
          </p>
        </div>
      </header>
      {error && (
        <p className="mb-4 rounded-apple bg-red-50 px-4 py-3 text-red-700" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-4 rounded-apple bg-emerald-50 px-4 py-3 text-emerald-800" role="status">
          {notice}
        </p>
      )}
      {config ? (
        <form onSubmit={save}>
          <Card className="mb-5">
            <h2 className="mb-4 text-xl font-bold">Invoice seller</h2>
            <p className="mb-4">Enter the legal billing identity and exact tax wording to print on invoices. Required before issuing an invoice; existing invoices keep their original details.</p>
            <BillingPartyFields issuer value={config.issuer} onChange={issuer => setSettings((s:any)=>({...s,configuration:{...s.configuration,issuer}}))}/>
          </Card>
          <Card className="mb-5">
            <h2 className="mb-2 text-xl font-bold">Services</h2>
            <p className="mb-4">
              Medical verification starts at €25. Add rituals with the prices
              you choose.
            </p>
            {config.services.map((s: any, i: number) => (
              <fieldset className="mt-4 rounded-apple-lg border border-apple-gray-200 bg-apple-surface p-5" key={i}>
                <legend className="px-1 text-sm font-semibold text-apple-gray-700">Service {i + 1}</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <AppleInput
                    label="Stable service code"
                    required
                    value={s.code}
                    onChange={(value) =>
                      change("services", i, "code", value)
                    }
                  />
                  <AppleInput
                    label="English name"
                    required
                    value={s.names.en}
                    onChange={(value) =>
                      change("services", i, "names", {
                        ...s.names,
                        en: value,
                      })
                    }
                  />
                  <AppleInput
                    label="Czech name"
                    value={s.names.cz || ""}
                    onChange={(value) =>
                      change("services", i, "names", {
                        ...s.names,
                        cz: value || s.names.en,
                      })
                    }
                  />
                  <AppleInput
                    label="Polish name"
                    value={s.names.pl || ""}
                    onChange={(value) =>
                      change("services", i, "names", {
                        ...s.names,
                        pl: value || s.names.en,
                      })
                    }
                  />
                  <label className={`${labelClasses} col-span-full`}>
                    English description
                    <textarea
                      maxLength={500}
                      rows={2}
                      value={s.descriptions?.en || ""}
                      onChange={(e) =>
                        change("services", i, "descriptions", {
                          ...s.descriptions,
                          en: e.target.value,
                        })
                      }
                      className={textareaClasses}
                    />
                  </label>
                  <label className={`${labelClasses} col-span-full`}>
                    Czech description
                    <textarea
                      maxLength={500}
                      rows={2}
                      value={s.descriptions?.cz || ""}
                      onChange={(e) =>
                        change("services", i, "descriptions", {
                          ...s.descriptions,
                          cz: e.target.value,
                        })
                      }
                      className={textareaClasses}
                    />
                  </label>
                  <label className={`${labelClasses} col-span-full`}>
                    Polish description
                    <textarea
                      maxLength={500}
                      rows={2}
                      value={s.descriptions?.pl || ""}
                      onChange={(e) =>
                        change("services", i, "descriptions", {
                          ...s.descriptions,
                          pl: e.target.value,
                        })
                      }
                      className={textareaClasses}
                    />
                  </label>
                  <AppleInput
                    label="Default price"
                    required
                    type="number"
                    min="0"
                    value={s.price}
                    onChange={(value) =>
                      change("services", i, "price", Number(value))
                    }
                  />
                  <label className={labelClasses}>
                    Currency
                    <select
                      value={s.currency}
                      onChange={(e) =>
                        change("services", i, "currency", e.target.value)
                      }
                      className={selectClasses}
                    >
                      {["EUR", "CZK", "PLN", "USD"].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClasses}>
                    Default policy
                    <select
                      value={s.policyCode}
                      onChange={(e) =>
                        change("services", i, "policyCode", e.target.value)
                      }
                      className={selectClasses}
                    >
                      {config.policies.map((p: any) => (
                        <option key={p.code} value={p.code}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClasses}>
                    Availability
                    <select
                      value={s.active ? "active" : "inactive"}
                      onChange={(e) =>
                        change(
                          "services",
                          i,
                          "active",
                          e.target.value === "active",
                        )
                      }
                      className={selectClasses}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>
              </fieldset>
            ))}
            <AppleButton
              variant="secondary"
              className="mt-4"
              type="button"
              onClick={() =>
                setSettings({
                  ...settings,
                  configuration: {
                    ...config,
                    services: [
                      ...config.services,
                      {
                        code: "",
                        names: { en: "" },
                        price: 0,
                        currency: "EUR",
                        active: true,
                        policyCode: config.policies[0].code,
                      },
                    ],
                  },
                })
              }
            >
              Add service
            </AppleButton>
          </Card>
          <Card className="mb-5">
            <h2 className="mb-2 text-xl font-bold">Payment & cancellation policies</h2>
            <p className="mb-4">
              Review final payment, cancellation and tax wording with the
              business before use. These templates are not legally validated.
              Saving a changed policy creates a new version.
            </p>
            {config.policies.map((p: any, i: number) => (
              <fieldset className="mt-4 rounded-apple-lg border border-apple-gray-200 bg-apple-surface p-5" key={i}>
                <legend className="px-1 text-sm font-semibold text-apple-gray-700">
                  Policy {i + 1} · version {p.version || 1}
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <AppleInput
                    label="Stable policy code"
                    required
                    value={p.code}
                    onChange={(value) =>
                      change("policies", i, "code", value)
                    }
                  />
                  <AppleInput
                    label="Template name"
                    required
                    value={p.name}
                    onChange={(value) =>
                      change("policies", i, "name", value)
                    }
                  />
                  <label className={labelClasses}>
                    Terms language
                    <select
                      value={p.language}
                      onChange={(e) =>
                        change("policies", i, "language", e.target.value)
                      }
                      className={selectClasses}
                    >
                      {["en", "cz", "pl", "de", "ru"].map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className={`${labelClasses} mt-4`}>
                  Policy acknowledgement
                  <select
                    value={p.acknowledgementRequired ? "required" : "optional"}
                    onChange={(e) =>
                      change(
                        "policies",
                        i,
                        "acknowledgementRequired",
                        e.target.value === "required",
                      )
                    }
                    className={selectClasses}
                  >
                    <option value="optional">No acknowledgement needed</option>
                    <option value="required">
                      Client must acknowledge these terms
                    </option>
                  </select>
                </label>
                <label className={`${labelClasses} mt-4`}>
                  Payment terms
                  <textarea
                    required
                    rows={3}
                    maxLength={2000}
                    value={p.paymentTerms}
                    onChange={(e) =>
                      change("policies", i, "paymentTerms", e.target.value)
                    }
                    className={textareaClasses}
                  />
                </label>
                <label className={`${labelClasses} mt-4`}>
                  Cancellation & refund terms
                  <textarea
                    required
                    rows={3}
                    maxLength={2000}
                    value={p.cancellationTerms}
                    onChange={(e) =>
                      change("policies", i, "cancellationTerms", e.target.value)
                    }
                    className={textareaClasses}
                  />
                </label>
              </fieldset>
            ))}
            <AppleButton
              variant="secondary"
              className="mt-4"
              type="button"
              onClick={() =>
                setSettings({
                  ...settings,
                  configuration: {
                    ...config,
                    policies: [
                      ...config.policies,
                      {
                        code: "",
                        name: "",
                        language: "en",
                        version: 1,
                        paymentTerms: "",
                        cancellationTerms: "",
                      },
                    ],
                  },
                })
              }
            >
              Add policy
            </AppleButton>
          </Card>
          <Card className="mb-5">
            <h2 className="mb-4 text-xl font-bold">Payment methods</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(config.paymentMethods).map(([key, value]) => (
                <AppleInput
                  key={key}
                  label={
                    (
                      {
                        revolutUrl: "Revolut link",
                        revolutHandle: "Revolut handle",
                        paypalUrl: "PayPal.Me link",
                        paypalEmail: "PayPal email",
                        iban: "IBAN",
                        bic: "BIC / SWIFT",
                        recipient: "Recipient",
                        bank: "Bank",
                        address: "Recipient address",
                      } as any
                    )[key]
                  }
                  required
                  value={String(value)}
                  onChange={(v) =>
                    setSettings({
                      ...settings,
                      configuration: {
                        ...config,
                        paymentMethods: {
                          ...config.paymentMethods,
                          [key]: v,
                        },
                      },
                    })
                  }
                />
              ))}
            </div>
          </Card>
          <AppleButton disabled={busy} type="submit">
            {busy ? "Saving…" : "Save settings"}
          </AppleButton>
        </form>
      ) : (
        !error && <p>Loading settings…</p>
      )}
    </main>
  );
}
