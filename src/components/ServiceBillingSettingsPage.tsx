import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { serviceRequestsApi } from "../services/api";
import "./ServicePaymentRequestPage.css";
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
    <main className="service-request-page">
      <header className="sr-heading">
        <div>
          <Link to="/admin/payment-requests/services/new">
            ← New service request
          </Link>
          <h1>Service billing settings</h1>
          <p>
            Configure your catalog, policy templates and payment recipients.
          </p>
        </div>
      </header>
      {error && (
        <p className="sr-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="sr-notice" role="status">
          {notice}
        </p>
      )}
      {config ? (
        <form onSubmit={save}>
          <section className="sr-card">
            <h2>Services</h2>
            <p>
              Medical verification starts at €25. Add rituals with the prices
              you choose.
            </p>
            {config.services.map((s: any, i: number) => (
              <fieldset className="sr-card" key={i}>
                <legend>Service {i + 1}</legend>
                <div className="sr-fields">
                  <label>
                    Stable service code
                    <input
                      required
                      value={s.code}
                      onChange={(e) =>
                        change("services", i, "code", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    English name
                    <input
                      required
                      value={s.names.en}
                      onChange={(e) =>
                        change("services", i, "names", {
                          ...s.names,
                          en: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Czech name
                    <input
                      value={s.names.cz || ""}
                      onChange={(e) =>
                        change("services", i, "names", {
                          ...s.names,
                          cz: e.target.value || s.names.en,
                        })
                      }
                    />
                  </label>
                  <label>
                    Polish name
                    <input
                      value={s.names.pl || ""}
                      onChange={(e) =>
                        change("services", i, "names", {
                          ...s.names,
                          pl: e.target.value || s.names.en,
                        })
                      }
                    />
                  </label>
                  <label>
                    English description
                    <textarea
                      maxLength={500}
                      value={s.descriptions?.en || ""}
                      onChange={(e) =>
                        change("services", i, "descriptions", {
                          ...s.descriptions,
                          en: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Czech description
                    <textarea
                      maxLength={500}
                      value={s.descriptions?.cz || ""}
                      onChange={(e) =>
                        change("services", i, "descriptions", {
                          ...s.descriptions,
                          cz: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Polish description
                    <textarea
                      maxLength={500}
                      value={s.descriptions?.pl || ""}
                      onChange={(e) =>
                        change("services", i, "descriptions", {
                          ...s.descriptions,
                          pl: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Default price
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={s.price}
                      onChange={(e) =>
                        change("services", i, "price", Number(e.target.value))
                      }
                    />
                  </label>
                  <label>
                    Currency
                    <select
                      value={s.currency}
                      onChange={(e) =>
                        change("services", i, "currency", e.target.value)
                      }
                    >
                      {["EUR", "CZK", "PLN", "USD"].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Default policy
                    <select
                      value={s.policyCode}
                      onChange={(e) =>
                        change("services", i, "policyCode", e.target.value)
                      }
                    >
                      {config.policies.map((p: any) => (
                        <option key={p.code} value={p.code}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
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
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>
              </fieldset>
            ))}
            <button
              className="sr-secondary"
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
            </button>
          </section>
          <section className="sr-card">
            <h2>Payment & cancellation policies</h2>
            <p>
              Review final payment, cancellation and tax wording with the
              business before use. These templates are not legally validated.
              Saving a changed policy creates a new version.
            </p>
            {config.policies.map((p: any, i: number) => (
              <fieldset className="sr-card" key={i}>
                <legend>
                  Policy {i + 1} · version {p.version || 1}
                </legend>
                <div className="sr-fields">
                  <label>
                    Stable policy code
                    <input
                      required
                      value={p.code}
                      onChange={(e) =>
                        change("policies", i, "code", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Template name
                    <input
                      required
                      value={p.name}
                      onChange={(e) =>
                        change("policies", i, "name", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Terms language
                    <select
                      value={p.language}
                      onChange={(e) =>
                        change("policies", i, "language", e.target.value)
                      }
                    >
                      {["en", "cz", "pl", "de", "ru"].map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
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
                  >
                    <option value="optional">No acknowledgement needed</option>
                    <option value="required">
                      Client must acknowledge these terms
                    </option>
                  </select>
                </label>
                <label className="mt-4">
                  Payment terms
                  <textarea
                    required
                    rows={3}
                    maxLength={2000}
                    value={p.paymentTerms}
                    onChange={(e) =>
                      change("policies", i, "paymentTerms", e.target.value)
                    }
                  />
                </label>
                <label className="mt-4">
                  Cancellation & refund terms
                  <textarea
                    required
                    rows={3}
                    maxLength={2000}
                    value={p.cancellationTerms}
                    onChange={(e) =>
                      change("policies", i, "cancellationTerms", e.target.value)
                    }
                  />
                </label>
              </fieldset>
            ))}
            <button
              className="sr-secondary"
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
            </button>
          </section>
          <section className="sr-card">
            <h2>Payment methods</h2>
            <div className="sr-fields">
              {Object.entries(config.paymentMethods).map(([key, value]) => (
                <label key={key}>
                  {
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
                  <input
                    required
                    value={String(value)}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        configuration: {
                          ...config,
                          paymentMethods: {
                            ...config.paymentMethods,
                            [key]: e.target.value,
                          },
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </section>
          <button disabled={busy} type="submit" className="sr-primary">
            {busy ? "Saving…" : "Save settings"}
          </button>
        </form>
      ) : (
        !error && <p>Loading settings…</p>
      )}
    </main>
  );
}
