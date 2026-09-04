import React, { useState, useEffect } from 'react';
import { currencyService, ExchangeRates } from '../services/currencyService';
import { configSummaryApi, paymentsApi } from '../services/api';
import ExpenseTypesSettings from './ExpenseTypesSettings';
import './CurrencySettings.css';

interface CurrencySettingsProps {
  onClose: () => void;
}

type ConverterCurrency = 'USD' | 'EUR' | 'CZK' | 'PLN';
type PaymentTypeSetting = { key: string; label: string; active: boolean; sortOrder: number; system: boolean; behavior: string };
type PaymentPlanSettings = { enabled: boolean; automaticallyCreateBalanceRequest: boolean; balanceDueDaysBeforeRetreat: number; reminderAutomationEnabled: boolean; reminderOffsetsDays: number[]; showFuturePaymentRequestInPortal: boolean; publicPaymentRequestBaseUrl: string; receiptAttachPdf: boolean; receiptAttachBookingConfirmation: boolean; receiptPortalBaseUrl: string };
const converterCurrencies: ConverterCurrency[] = ['PLN', 'USD', 'EUR', 'CZK'];

const CurrencySettings: React.FC<CurrencySettingsProps> = ({ onClose }) => {
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [configSummary, setConfigSummary] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [nextUpdate, setNextUpdate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [converterAmount, setConverterAmount] = useState('4500');
  const [converterFromCurrency, setConverterFromCurrency] = useState<ConverterCurrency>('PLN');
  const [converterToCurrency, setConverterToCurrency] = useState<ConverterCurrency>('USD');
  const [converterResult, setConverterResult] = useState<number | null>(null);
  const [converterSource, setConverterSource] = useState<string>('');
  const [converterError, setConverterError] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [activeTab, setActiveTab] = useState<'currency' | 'payment-types' | 'expense-types' | 'payment-plan'>('currency');
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeSetting[]>([]);
  const [paymentTypesSaving, setPaymentTypesSaving] = useState(false);
  const [newPaymentType, setNewPaymentType] = useState({ key: '', label: '' });
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlanSettings>({ enabled: true, automaticallyCreateBalanceRequest: true, balanceDueDaysBeforeRetreat: 30, reminderAutomationEnabled: true, reminderOffsetsDays: [5, 3, 0, -1], showFuturePaymentRequestInPortal: true, publicPaymentRequestBaseUrl: 'https://ibogaspirit.com/clients/payment/request', receiptAttachPdf: true, receiptAttachBookingConfirmation: false, receiptPortalBaseUrl: 'https://www.ibogaready.com' });
  const [paymentPlanSaving, setPaymentPlanSaving] = useState(false);

  useEffect(() => {
    loadExchangeRates();
  }, []);

  const loadExchangeRates = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [info, configResponse] = await Promise.all([
        currencyService.getExchangeRateInfo(),
        configSummaryApi.get().catch(() => null),
      ]);
      setRates(info.rates);
      setLastUpdated(info.lastUpdated);
      setNextUpdate(info.nextUpdate);
      setConfigSummary(configResponse?.data || null);
      const typeResponse = await paymentsApi.getTypes().catch(() => null);
      setPaymentTypes(typeResponse?.data || []);
      const planResponse = typeof paymentsApi.getPlanSettings === 'function'
        ? await paymentsApi.getPlanSettings().catch(() => null)
        : null;
      if (planResponse?.data) setPaymentPlan(current => ({ ...current, ...planResponse.data, reminderOffsetsDays: planResponse.data.reminderOffsetsDays || current.reminderOffsetsDays }));
    } catch (err) {
      setError('Failed to load exchange rates');
      console.error('Error loading exchange rates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const savePaymentPlan = async () => {
    try {
      setPaymentPlanSaving(true);
      const response = await paymentsApi.savePlanSettings(paymentPlan);
      setPaymentPlan(response.data);
      alert('Payment plan settings saved. Booking updates will synchronize their payment requests automatically.');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Could not save payment plan settings.');
    } finally {
      setPaymentPlanSaving(false);
    }
  };

  const savePaymentType = async (item: PaymentTypeSetting) => {
    try {
      setPaymentTypesSaving(true);
      await paymentsApi.updateType(item.key, { label: item.label, active: item.active, sortOrder: item.sortOrder });
      const response = await paymentsApi.getTypes();
      setPaymentTypes(response.data || []);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Could not save the payment type.');
    } finally {
      setPaymentTypesSaving(false);
    }
  };

  const addPaymentType = async () => {
    try {
      setPaymentTypesSaving(true);
      await paymentsApi.createType({ ...newPaymentType, sortOrder: paymentTypes.length * 10 + 100 });
      setNewPaymentType({ key: '', label: '' });
      const response = await paymentsApi.getTypes();
      setPaymentTypes(response.data || []);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Could not create the payment type.');
    } finally {
      setPaymentTypesSaving(false);
    }
  };

  const handleRefreshRates = async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      const newRates = await currencyService.forceRefreshRates();
      setRates(newRates);
      const info = await currencyService.getExchangeRateInfo();
      setLastUpdated(info.lastUpdated);
      setNextUpdate(info.nextUpdate);
      alert('Exchange rates updated successfully!');
    } catch (err) {
      setError('Failed to refresh exchange rates');
      console.error('Error refreshing exchange rates:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const convertAmount = async () => {
    const amount = Number(converterAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setConverterResult(null);
      setConverterError('Enter an amount greater than zero.');
      return;
    }

    try {
      setIsConverting(true);
      setConverterError(null);
      const response = await paymentsApi.convert(amount, converterFromCurrency, converterToCurrency);
      setConverterResult(response.data.amount);
      setConverterSource(response.data.provider || 'ECB reference rate');
    } catch (err) {
      try {
        const usdAmount = await currencyService.convertToUSD(amount, converterFromCurrency);
        const convertedAmount = await currencyService.convertFromUSD(usdAmount, converterToCurrency);
        setConverterResult(convertedAmount);
        setConverterSource('cached browser rate');
      } catch (fallbackErr) {
        setConverterResult(null);
        setConverterSource('');
        setConverterError('Failed to convert currency.');
      }
    } finally {
      setIsConverting(false);
    }
  };

  const testConversion = async (amount: number, currency: 'EUR' | 'CZK' | 'PLN') => {
    try {
      const usdAmount = await currencyService.convertToUSD(amount, currency);
      alert(`${amount} ${currency} = $${usdAmount.toFixed(2)} USD`);
    } catch (err) {
      alert('Failed to convert currency');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="currency-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="currency-header">
          <h2>Settings</h2>
          <button onClick={onClose} className="close-btn" aria-label="Close currency converter">✕</button>
        </div>

        <div className="settings-tabs">
          <button className={activeTab === 'currency' ? 'active' : ''} onClick={() => setActiveTab('currency')}>Currency</button>
          <button className={activeTab === 'payment-types' ? 'active' : ''} onClick={() => setActiveTab('payment-types')}>Payment types</button>
          <button className={activeTab === 'expense-types' ? 'active' : ''} onClick={() => setActiveTab('expense-types')}>Expense types</button>
          <button className={activeTab === 'payment-plan' ? 'active' : ''} onClick={() => setActiveTab('payment-plan')}>Payment plan</button>
        </div>

        {activeTab === 'payment-plan' ? (
          <div className="payment-types-settings payment-plan-settings">
            <h3>Booking payment plan</h3>
            <p>This rule creates one final-balance request per booking. It is updated when the booking, price, currency, or retreat date changes and cancelled when the booking is cancelled.</p>
            <label><input type="checkbox" checked={paymentPlan.enabled} onChange={(event) => setPaymentPlan(current => ({ ...current, enabled: event.target.checked }))} /> Enable payment-plan automation</label>
            <label><input type="checkbox" checked={paymentPlan.automaticallyCreateBalanceRequest} onChange={(event) => setPaymentPlan(current => ({ ...current, automaticallyCreateBalanceRequest: event.target.checked }))} /> Automatically create the final-balance payment request</label>
            <label><span>Final balance due before retreat</span><div className="payment-plan-number"><input type="number" min="0" max="365" value={paymentPlan.balanceDueDaysBeforeRetreat} onChange={(event) => setPaymentPlan(current => ({ ...current, balanceDueDaysBeforeRetreat: Number(event.target.value) }))} /><span>days</span></div></label>
            <label><input type="checkbox" checked={paymentPlan.reminderAutomationEnabled} onChange={(event) => setPaymentPlan(current => ({ ...current, reminderAutomationEnabled: event.target.checked }))} /> Automatically email unpaid final-balance reminders</label>
            <label><span>Reminder schedule (days before due; use -1 for one day after)</span><input value={paymentPlan.reminderOffsetsDays.join(', ')} onChange={(event) => setPaymentPlan(current => ({ ...current, reminderOffsetsDays: event.target.value.split(',').map(value => Number(value.trim())).filter(Number.isFinite) }))} /></label>
            <label><input type="checkbox" checked={paymentPlan.showFuturePaymentRequestInPortal} onChange={(event) => setPaymentPlan(current => ({ ...current, showFuturePaymentRequestInPortal: event.target.checked }))} /> Show the upcoming request in IbogaReady before it becomes due</label>
            <label><span>Public payment-request URL</span><input type="url" value={paymentPlan.publicPaymentRequestBaseUrl} onChange={(event) => setPaymentPlan(current => ({ ...current, publicPaymentRequestBaseUrl: event.target.value }))} /></label>
            <h3>Payment receipt emails</h3>
            <label><input type="checkbox" checked={paymentPlan.receiptAttachPdf} onChange={(event) => setPaymentPlan(current => ({ ...current, receiptAttachPdf: event.target.checked }))} /> Attach a formatted receipt PDF</label>
            <label><input type="checkbox" checked={paymentPlan.receiptAttachBookingConfirmation} onChange={(event) => setPaymentPlan(current => ({ ...current, receiptAttachBookingConfirmation: event.target.checked }))} /> Attach the latest stored booking confirmation PDF</label>
            <label><span>IbogaReady details link</span><input type="url" value={paymentPlan.receiptPortalBaseUrl} onChange={(event) => setPaymentPlan(current => ({ ...current, receiptPortalBaseUrl: event.target.value }))} /></label>
            <button className="convert-btn" disabled={paymentPlanSaving} onClick={savePaymentPlan}>{paymentPlanSaving ? 'Saving…' : 'Save payment plan'}</button>
          </div>
        ) : activeTab === 'expense-types' ? (
          <ExpenseTypesSettings />
        ) : activeTab === 'payment-types' ? (
          <div className="payment-types-settings">
            <h3>Payment types</h3>
            <p>IDs are permanent. Existing types can be renamed, reordered, or deactivated, but never deleted.</p>
            <div className="payment-type-list">
              {paymentTypes.map((item, index) => (
                <div className="payment-type-row" key={item.key}>
                  <code>{item.key}</code>
                  <input value={item.label} onChange={(event) => setPaymentTypes(current => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, label: event.target.value } : entry))} />
                  <input type="number" value={item.sortOrder} onChange={(event) => setPaymentTypes(current => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, sortOrder: Number(event.target.value) } : entry))} />
                  <label><input type="checkbox" checked={item.active} onChange={(event) => setPaymentTypes(current => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, active: event.target.checked } : entry))} /> Active</label>
                  <button disabled={paymentTypesSaving} onClick={() => savePaymentType(item)}>Save</button>
                </div>
              ))}
            </div>
            <div className="new-payment-type">
              <h4>Add payment type</h4>
              <input placeholder="immutable_id" value={newPaymentType.key} onChange={(event) => setNewPaymentType(current => ({ ...current, key: event.target.value }))} />
              <input placeholder="Display label" value={newPaymentType.label} onChange={(event) => setNewPaymentType(current => ({ ...current, label: event.target.value }))} />
              <button disabled={paymentTypesSaving || !newPaymentType.key || !newPaymentType.label} onClick={addPaymentType}>Add</button>
            </div>
          </div>
        ) : <>

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        <div className="currency-converter">
          <h3>Look up an exchange rate</h3>
          <form className="converter-controls" onSubmit={(event) => { event.preventDefault(); void convertAmount(); }}>
            <label>
              <span>Amount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={converterAmount}
                onChange={(event) => setConverterAmount(event.target.value)}
                placeholder="4500"
              />
            </label>
            <label>
              <span>From</span>
              <select
                value={converterFromCurrency}
                onChange={(event) => setConverterFromCurrency(event.target.value as ConverterCurrency)}
              >
                {converterCurrencies.map((code) => <option key={code} value={code}>{code}</option>)}
              </select>
            </label>
            <button type="button" className="swap-currencies-btn" aria-label="Swap currencies" onClick={() => {
              setConverterFromCurrency(converterToCurrency);
              setConverterToCurrency(converterFromCurrency);
              setConverterResult(null);
            }}>⇄</button>
            <label>
              <span>To</span>
              <select value={converterToCurrency} onChange={(event) => setConverterToCurrency(event.target.value as ConverterCurrency)}>
                {converterCurrencies.map((code) => <option key={code} value={code}>{code}</option>)}
              </select>
            </label>
            <button
              type="submit"
              disabled={isConverting}
              className="convert-btn"
            >
              {isConverting ? 'Converting...' : 'Convert'}
            </button>
          </form>
          {converterResult !== null && (
            <div className="converter-result">
              <strong>{Number(converterAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })} {converterFromCurrency}</strong>
              <span>=</span>
              <strong>{converterResult.toLocaleString(undefined, { style: 'currency', currency: converterToCurrency })}</strong>
              {converterSource && <small>{converterSource}</small>}
            </div>
          )}
          {converterError && <div className="converter-error">{converterError}</div>}
        </div>

        <div className="currency-info">
          <p><strong>Rate provider:</strong> {configSummary?.integrations?.exchangeRateProviderLabel || 'ECB reference rate'}</p>
          <p><strong>Rate data:</strong> {isLoading ? 'Loading…' : error ? 'Live lookup remains available' : `Updated ${lastUpdated}`}</p>
          {!isLoading && nextUpdate && <p><strong>Next cached-rate update:</strong> {nextUpdate}</p>}
        </div>

        <div className="currency-info">
          <h3>Application Configuration</h3>
          {configSummary ? (
            <div className="text-sm">
              <p><strong>API environment:</strong> {configSummary.runtime?.nodeEnv}</p>
              <p><strong>API port:</strong> {configSummary.runtime?.port}</p>
              <p><strong>Database:</strong> {configSummary.database?.configured ? `configured via ${configSummary.database?.mongoSource}` : 'local fallback'}</p>
              <p><strong>CORS origins:</strong> {configSummary.cors?.allowedOrigins?.length ? configSummary.cors.allowedOrigins.join(', ') : 'none configured'}</p>
              <p><strong>Storage provider:</strong> {configSummary.storage?.provider}</p>
              <p><strong>S3 configured:</strong> {configSummary.storage?.s3Configured ? 'Yes' : 'No'}</p>
              <p><strong>S3 bucket:</strong> {configSummary.storage?.bucket || 'not configured'}</p>
              <p><strong>S3 region:</strong> {configSummary.storage?.region}</p>
              <p><strong>S3 access key:</strong> {configSummary.storage?.accessKeyConfigured ? 'set' : 'missing'}</p>
              <p><strong>S3 secret:</strong> {configSummary.storage?.secretConfigured ? 'set' : 'missing'}</p>
              <p><strong>Medical artifact path:</strong> {configSummary.uploads?.medicalArtifactPathPattern}</p>
              <p><strong>Thumbnail path:</strong> {configSummary.uploads?.medicalArtifactThumbnailPathPattern}</p>
              <p><strong>Thumbnail size:</strong> {configSummary.uploads?.thumbnailWidth} x {configSummary.uploads?.thumbnailHeight}</p>
              <p><strong>ECB feed:</strong> official daily reference rates, cached for 4 hours</p>
              <p><strong>Google OAuth:</strong> {configSummary.integrations?.googleOAuthConfigured ? 'configured' : 'not configured'}</p>
              {!configSummary.storage?.s3Configured && (
                <div className="error-message">
                  Medical artifact uploads require S3 config: {configSummary.storage?.requiredEnvironment?.join(', ')}
                </div>
              )}
            </div>
          ) : (
            <p>Configuration summary is only visible to admins or could not be loaded.</p>
          )}
        </div>

        {rates && (
          <div className="exchange-rates-table">
            <h3>Current Exchange Rates (to USD)</h3>
            <table className="rates-table">
              <thead>
                <tr>
                  <th>Currency</th>
                  <th>Code</th>
                  <th>Rate</th>
                  <th>Example</th>
                  <th>Test</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>🇪🇺 Euro</td>
                  <td>EUR</td>
                  <td>{rates.EUR.toFixed(4)}</td>
                  <td>€100 = ${(100 * rates.EUR).toFixed(2)}</td>
                  <td>
                    <button
                      onClick={() => testConversion(100, 'EUR')}
                      className="test-btn"
                    >
                      Test €100
                    </button>
                  </td>
                </tr>
                <tr>
                  <td>🇺🇸 US Dollar</td>
                  <td>USD</td>
                  <td>1.0000</td>
                  <td>$100 = $100.00</td>
                  <td>
                    <span className="base-currency">Base</span>
                  </td>
                </tr>
                <tr>
                  <td>🇨🇿 Czech Koruna</td>
                  <td>CZK</td>
                  <td>{rates.CZK.toFixed(4)}</td>
                  <td>1000 Kč = ${(1000 * rates.CZK).toFixed(2)}</td>
                  <td>
                    <button
                      onClick={() => testConversion(1000, 'CZK')}
                      className="test-btn"
                    >
                      Test 1000 Kč
                    </button>
                  </td>
                </tr>
                <tr>
                  <td>🇵🇱 Polish Złoty</td>
                  <td>PLN</td>
                  <td>{rates.PLN.toFixed(4)}</td>
                  <td>100 zł = ${(100 * rates.PLN).toFixed(2)}</td>
                  <td>
                    <button
                      onClick={() => testConversion(100, 'PLN')}
                      className="test-btn"
                    >
                      Test 100 zł
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="currency-actions">
          <button
            onClick={handleRefreshRates}
            disabled={isRefreshing}
            className="refresh-btn"
          >
            {isRefreshing ? '🔄 Refreshing...' : '🔄 Refresh Rates Now'}
          </button>

          <div className="currency-note">
            <p><strong>Note:</strong> Exchange rates are automatically updated every 4 hours.
            All amounts in the application will show USD equivalents in parentheses.</p>
          </div>
        </div>
        </>}

        <div className="currency-footer">
          <button onClick={onClose} className="close-settings-btn">
            Close Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default CurrencySettings;
