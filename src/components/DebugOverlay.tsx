import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { API_BASE_URL } from '../config/api.config';
import './DebugOverlay.css';
import { useAuth } from '../context/AuthContext';
import { initializeApiDebug } from '../utils/apiDebug';

interface ConnectionStatus {
  isConnected: boolean;
  lastChecked: Date;
  error?: string;
  responseTime?: number;
}

const DebugOverlay: React.FC = () => {
  const { user } = useAuth();
  const [debugEnabled, setDebugEnabled] = useState(() => initializeApiDebug(user));
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    lastChecked: new Date(),
  });


  // Extract host and port from URL
  const getHostAndPort = (url: string) => {
    try {
      const urlObj = new URL(url);
      return {
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80'),
        fullUrl: url
      };
    } catch {
      return {
        protocol: 'http:',
        hostname: 'localhost',
        port: '3005',
        fullUrl: url
      };
    }
  };

  const urlInfo = getHostAndPort(API_BASE_URL);

  // Check API connection
  const checkConnection = async () => {
    const startTime = Date.now();
    try {
      await api.get('/', { suppressGlobalError: true } as any);
      const responseTime = Date.now() - startTime;
      setConnectionStatus({
        isConnected: true,
        lastChecked: new Date(),
        responseTime,
      });
    } catch (error: any) {
      setConnectionStatus({
        isConnected: false,
        lastChecked: new Date(),
        error: error.message || 'Connection failed',
      });
    }
  };

  useEffect(() => {
    setDebugEnabled(initializeApiDebug(user));
    const handleDebugChange = () => setDebugEnabled(initializeApiDebug(user));
    window.addEventListener('api-debug-change', handleDebugChange);
    return () => window.removeEventListener('api-debug-change', handleDebugChange);
  }, [user]);

  useEffect(() => {
    if (!debugEnabled) return;
    // Initial check
    checkConnection();

    // Check connection every 10 seconds
    const interval = setInterval(checkConnection, 10000);

    // Toggle visibility with keyboard shortcut (Ctrl/Cmd + Shift + D)
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [debugEnabled]);

  if (!debugEnabled) return null;

  if (!isVisible) {
    return (
      <button
        className="debug-overlay-toggle"
        onClick={() => setIsVisible(true)}
        title="Show Debug Info (Ctrl/Cmd + Shift + D)"
      >
        🔧
      </button>
    );
  }

  if (isMinimized) {
    return (
      <div className="debug-overlay-minimized">
        <button onClick={() => setIsMinimized(false)}>
          API: {urlInfo.port} {connectionStatus.isConnected ? '✅' : '❌'}
        </button>
      </div>
    );
  }

  return (
    <div className="debug-overlay">
      <div className="debug-overlay-header">
        <h4>🔧 Debug Info</h4>
        <div className="debug-overlay-actions">
          <button onClick={() => setIsMinimized(true)} title="Minimize">_</button>
          <button onClick={() => setIsVisible(false)} title="Close (Ctrl/Cmd + Shift + D)">×</button>
        </div>
      </div>

      <div className="debug-overlay-content">
        <div className="debug-section">
          <h5>Backend Connection</h5>
          <table>
            <tbody>
              <tr>
                <td>Status:</td>
                <td>
                  <span className={connectionStatus.isConnected ? 'status-connected' : 'status-disconnected'}>
                    {connectionStatus.isConnected ? '✅ Connected' : '❌ Disconnected'}
                  </span>
                </td>
              </tr>
              <tr>
                <td>URL:</td>
                <td className="debug-url">{urlInfo.fullUrl}</td>
              </tr>
              <tr>
                <td>Protocol:</td>
                <td>{urlInfo.protocol.replace(':', '')}</td>
              </tr>
              <tr>
                <td>Host:</td>
                <td>{urlInfo.hostname}</td>
              </tr>
              <tr>
                <td>Port:</td>
                <td className="debug-port">{urlInfo.port}</td>
              </tr>
              {connectionStatus.responseTime && (
                <tr>
                  <td>Response Time:</td>
                  <td>{connectionStatus.responseTime}ms</td>
                </tr>
              )}
              {connectionStatus.error && (
                <tr>
                  <td>Error:</td>
                  <td className="debug-error">{connectionStatus.error}</td>
                </tr>
              )}
              <tr>
                <td>Last Checked:</td>
                <td>{connectionStatus.lastChecked.toLocaleTimeString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="debug-section">
          <h5>Environment</h5>
          <table>
            <tbody>
              <tr>
                <td>Mode:</td>
                <td>{process.env.NODE_ENV}</td>
              </tr>
              <tr>
                <td>React Version:</td>
                <td>{React.version}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="debug-actions">
          <button onClick={checkConnection} className="debug-refresh-btn">
            🔄 Refresh Connection
          </button>
        </div>
      </div>
    </div>
  );
};

export default DebugOverlay;
