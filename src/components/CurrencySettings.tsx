import React, { useState, useEffect } from 'react';
import { currencyService, ExchangeRates } from '../services/currencyService';
import './CurrencySettings.css';

interface CurrencySettingsProps {
  onClose: () => void;
}

const CurrencySettings: React.FC<CurrencySettingsProps> = ({ onClose }) => {
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [nextUpdate, setNextUpdate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadExchangeRates();
  }, []);

  const loadExchangeRates = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const info = await currencyService.getExchangeRateInfo();
      setRates(info.rates);
      setLastUpdated(info.lastUpdated);
      setNextUpdate(info.nextUpdate);
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
          <p><strong>Base Currency:</strong> USD (US Dollar)</p>
          <p><strong>Last Updated:</strong> {lastUpdated}</p>
          <p><strong>Next Auto Update:</strong> {nextUpdate}</p>
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