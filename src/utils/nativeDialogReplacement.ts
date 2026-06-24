import { message } from 'antd';

let installed = false;

const getAlertText = (value?: unknown) => {
  if (value === undefined || value === null) return '';
  if (value instanceof Error) return value.message;
  return String(value);
};

const getMessageType = (text: string): 'success' | 'error' | 'warning' => {
  const normalized = text.toLowerCase();

  if (/(error|failed|unable|cannot|could not|invalid|not found|try again)/.test(normalized)) {
    return 'error';
  }

  if (/(please|required|missing|select|choose|must|warning|check)/.test(normalized)) {
    return 'warning';
  }

  return 'success';
};

export const installNativeDialogReplacement = () => {
  if (installed || typeof window === 'undefined') return;

  installed = true;
  message.config({
    top: 96,
    duration: 3.5,
    maxCount: 3,
  });

  window.alert = (value?: unknown) => {
    const text = getAlertText(value).trim();
    if (!text) return;

    const type = getMessageType(text);
    message[type](text);
  };
};
