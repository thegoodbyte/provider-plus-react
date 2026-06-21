import React, { useState, useEffect } from 'react';
import { currencyService, ExchangeRates } from '../services/currencyService';
import { configSummaryApi, paymentsApi } from '../services/api';
import { API_BASE_URL } from '../config/api.config';
import './CurrencySettings.css';

interface CurrencySettingsProps {
  onClose: () => void;
}

const CurrencySettings: React.FC<CurrencySettingsProps> = ({ onClose }) => {
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [configSummary, setConfigSummary] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [nextUpdate, setNextUpdate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [converterAmount, setConverterAmount] = useState('1000');
  const [converterCurrency, setConverterCurrency] = useState<'USD' | 'EUR' | 'CZK' | 'PLN'>('PLN');
  const [converterResult, setConverterResult] = useState<number | null>(null);
  const [converterSource, setConverterSource] = useState<string>('');
  const [converterError, setConverterError] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);

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
    } catch (err) {
      setError('Failed to load exchange rates');
      console.error('Error loading exchange rates:', err);
    } finally {
      setIsLoading(false);
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

  const convertAmountToUsd = async () => {
    const amount = Number(converterAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setConverterResult(null);
      setConverterError('Enter an amount greater than zero.');
      return;
    }

    try {
      setIsConverting(true);
      setConverterError(null);
      const response = await paymentsApi.convertToUsd(amount, converterCurrency);
      setConverterResult(response.data.usd_amount);
      setConverterSource('API rate');
    } catch (err) {
      try {
        const usdAmount = await currencyService.convertToUSD(amount, converterCurrency);
        setConverterResult(usdAmount);
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

  if (isLoading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="currency-settings-modal" onClick={(e) => e.stopPropagation()}>
          <div className="currency-loading">
            <div className="loading-spinner">💱</div>
            <p>Loading exchange rates...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="currency-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="currency-header">
          <h2>💱 Currency Exchange Rates</h2>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        <div className="currency-info">
          <p><strong>Frontend API URL:</strong> {API_BASE_URL}</p>
          <p><strong>Base Currency:</strong> USD (US Dollar)</p>
          <p><strong>Last Updated:</strong> {lastUpdated}</p>
          <p><strong>Next Auto Update:</strong> {nextUpdate}</p>
        </div>

        <div className="currency-converter">
          <h3>Convert to USD</h3>
          <div className="converter-controls">
            <label>
              <span>Amount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={converterAmount}
                onChange={(event) => setConverterAmount(event.target.value)}
                placeholder="1000"
              />
            </label>
            <label>
              <span>Currency</span>
              <select
                value={converterCurrency}
                onChange={(event) => setConverterCurrency(event.target.value as 'USD' | 'EUR' | 'CZK' | 'PLN')}
              >
                <option value="PLN">PLN</option>
                <option value="CZK">CZK</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <button
              type="button"
              onClick={convertAmountToUsd}
              disabled={isConverting}
              className="convert-btn"
            >
              {isConverting ? 'Converting...' : 'Convert'}
            </button>
          </div>
          {converterResult !== null && (
            <div className="converter-result">
              <strong>{Number(converterAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })} {converterCurrency}</strong>
              <span>=</span>
              <strong>{converterResult.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</strong>
              {converterSource && <small>{converterSource}</small>}
            </div>
          )}
          {converterError && <div className="converter-error">{converterError}</div>}
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
              <p><strong>Revolut token:</strong> {configSummary.integrations?.revolutApiTokenConfigured ? 'set' : 'missing'}</p>
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
