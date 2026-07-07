import React from 'react';
import { render, waitFor } from '@testing-library/react';
import MedicalRecordsManager from './MedicalRecordsManager';
import { medicalArtifactsApi } from '../services/api';

jest.mock('antd', () => {
  const React = require('react');
  const passthrough = (TagName: string) =>
    React.forwardRef(({ children, ...props }: any, ref: any) =>
      React.createElement(TagName, { ref, ...props }, children),
    );

  return {
    Button: passthrough('button'),
    Select: Object.assign(passthrough('select'), { Option: passthrough('option') }),
    Input: Object.assign(passthrough('input'), { TextArea: passthrough('textarea') }),
    DatePicker: passthrough('input'),
    Tabs: Object.assign(passthrough('div'), { TabPane: passthrough('div') }),
    Badge: passthrough('div'),
    Collapse: Object.assign(passthrough('div'), { Panel: passthrough('div') }),
    Modal: passthrough('div'),
    Upload: Object.assign(passthrough('div'), { Dragger: passthrough('div') }),
    Tag: passthrough('span'),
    message: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
  };
});

jest.mock('../services/api', () => ({
  medicalArtifactsApi: {
    getAll: jest.fn().mockResolvedValue({ data: [] }),
    create: jest.fn(),
    update: jest.fn(),
    uploadFiles: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('MedicalRecordsManager', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    (medicalArtifactsApi.getAll as jest.Mock).mockClear();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('reloads records when the refresh key changes', async () => {
    const { rerender } = render(
      <MedicalRecordsManager clientId="client-1" refreshKey={0} />,
    );

    await waitFor(() => {
      expect(medicalArtifactsApi.getAll).toHaveBeenCalledTimes(1);
    });

    rerender(<MedicalRecordsManager clientId="client-1" refreshKey={1} />);

    await waitFor(() => {
      expect(medicalArtifactsApi.getAll).toHaveBeenCalledTimes(2);
    });
  });
});
