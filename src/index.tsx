import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ConfigProvider } from 'antd';
import { appTheme } from './design/theme';
import './design/tokens.css';
import './design/system.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <ConfigProvider theme={appTheme}><App /></ConfigProvider>
  </React.StrictMode>
);

// Removed reportWebVitals for better performance
