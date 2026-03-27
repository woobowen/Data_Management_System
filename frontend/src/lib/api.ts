import axios from 'axios';
import { AxiosError } from 'axios';

import type { AnswerValue, SurveyDefinition } from '../state/survey-engine';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/',
  timeout: 8000,
});

export class ApiClientError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
  }
}

function normalizeApiError(error: unknown): never {
  if (error instanceof AxiosError) {
    const message =
      (error.response?.data as { message?: string } | undefined)?.message ||
      error.message ||
      '请求失败';
    throw new ApiClientError(message, error.response?.status);
  }
  throw error;
}

export async function fetchSurveyDefinition(surveyId: string): Promise<SurveyDefinition> {
  try {
    const response = await api.get<{ code: number; message: string; data: SurveyDefinition }>(`/api/surveys/${surveyId}/render`);
    return response.data.data;
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function submitSurveyResponse(surveyId: string, answers: AnswerValue[]) {
  try {
    return await api.post(`/api/surveys/${surveyId}/submit`, { answers });
  } catch (error) {
    normalizeApiError(error);
  }
}
