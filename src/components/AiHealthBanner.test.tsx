import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import AiHealthBanner from './AiHealthBanner';
import { configSummaryApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

jest.mock('../services/api', () => ({ configSummaryApi: { get: jest.fn() } }));
jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));

describe('AiHealthBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: { role: 'admin' } });
  });

  it('renders nothing for a non-admin user, without even calling config-summary', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { role: 'facilitator' } });
    render(<AiHealthBanner />);

    await waitFor(() => expect(configSummaryApi.get).not.toHaveBeenCalled());
    expect(screen.queryByText(/OpenAI/i)).not.toBeInTheDocument();
  });

  it('renders nothing when OpenAI is configured and every feature is healthy', async () => {
    (configSummaryApi.get as jest.Mock).mockResolvedValue({ data: { ai: { openAiConfigured: true, features: { assistant: { consecutiveFailures: 0 } } } } });
    render(<AiHealthBanner />);

    await waitFor(() => expect(configSummaryApi.get).toHaveBeenCalled());
    expect(screen.queryByText(/OpenAI/i)).not.toBeInTheDocument();
  });

  it('warns when OpenAI is not configured', async () => {
    (configSummaryApi.get as jest.Mock).mockResolvedValue({ data: { ai: { openAiConfigured: false, features: {} } } });
    render(<AiHealthBanner />);

    expect(await screen.findByText(/OpenAI is not configured/i)).toBeInTheDocument();
  });

  it('warns when a feature has failed repeatedly, even though OpenAI is configured', async () => {
    (configSummaryApi.get as jest.Mock).mockResolvedValue({
      data: { ai: { openAiConfigured: true, features: { food_matrix_translation: { consecutiveFailures: 4 }, assistant: { consecutiveFailures: 0 } } } },
    });
    render(<AiHealthBanner />);

    expect(await screen.findByText(/food matrix translation/i)).toBeInTheDocument();
  });

  it('fails silently (renders nothing) when config-summary is unreachable', async () => {
    (configSummaryApi.get as jest.Mock).mockRejectedValue(new Error('network error'));
    render(<AiHealthBanner />);

    await waitFor(() => expect(configSummaryApi.get).toHaveBeenCalled());
    expect(screen.queryByText(/OpenAI/i)).not.toBeInTheDocument();
  });
});
