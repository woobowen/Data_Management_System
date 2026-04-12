import axios from 'axios';
import { AxiosError } from 'axios';

import type { AnswerValue, SurveyDefinition } from '../state/survey-engine';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/',
  timeout: 8000,
});

export type AuthUser = {
  id: string;
  username: string;
};

export type SurveyQuestionInput = {
  questionId: string;
  type: 'single_choice' | 'multi_choice' | 'text' | 'number';
  title: string;
  description?: string;
  isRequired: boolean;
  order: number;
  options?: Array<{ optionId: string; text: string }>;
  validation?: {
    minSelected?: number;
    maxSelected?: number;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    isInteger?: boolean;
  };
  logicRules?: Array<{
    condition: 'eq' | 'gt' | 'lt' | 'includes';
    targetValue: unknown;
    nextQuestionId: string;
  }>;
  defaultNextQuestionId?: string;
  questionTemplateId?: string;
  questionTemplateVersion?: number;
};

export type SurveyPayload = {
  title: string;
  description: string;
  allowAnonymous: boolean;
  deadlineAt: string | null;
  questions: SurveyQuestionInput[];
};

export type SurveySummary = {
  _id: string;
  title: string;
  description: string;
  status: 'draft' | 'published' | 'closed';
  allowAnonymous: boolean;
  deadlineAt: string | null;
  questions: SurveyQuestionInput[];
  createdAt?: string;
  updatedAt?: string;
};

export type QuestionTemplatePayload = {
  title: string;
  description: string;
  type: 'single_choice' | 'multi_choice' | 'text' | 'number';
  isRequired: boolean;
  options?: Array<{ optionId: string; text: string }>;
  validation?: {
    minSelected?: number;
    maxSelected?: number;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    isInteger?: boolean;
  };
};

export type QuestionTemplateSummary = {
  _id: string;
  ownerId: string;
  rootTemplateId: string;
  version: number;
  previousTemplateId?: string | null;
  title: string;
  description: string;
  type: 'single_choice' | 'multi_choice' | 'text' | 'number';
  isRequired: boolean;
  options: Array<{ optionId: string; text: string }>;
  validation: {
    minSelected?: number;
    maxSelected?: number;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    isInteger?: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type QuestionTemplateShareResult = {
  templateId: string;
  usernames: string[];
};

export type StatisticsQuestion = {
  questionId: string;
  type: string;
  title: string;
  optionCounts: Array<{ questionId: string; optionId: string; count: number }>;
  average: number | null;
  responseCount: number;
  textValues: string[];
};

export type SurveyStatistics = {
  surveyId: string;
  questions: StatisticsQuestion[];
};

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

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export async function registerUser(username: string, password: string) {
  try {
    const response = await api.post<{ code: number; message: string; data: { id: string; username: string; createdAt: string } }>(
      '/api/auth/register',
      { username, password },
    );
    return response.data.data;
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function loginUser(username: string, password: string) {
  try {
    const response = await api.post<{ code: number; message: string; data: { token: string; user: AuthUser } }>(
      '/api/auth/login',
      { username, password },
    );
    return response.data.data;
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function listMySurveys(): Promise<SurveySummary[]> {
  try {
    const response = await api.get<{ code: number; message: string; data: SurveySummary[] }>('/api/surveys');
    return response.data.data;
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function getMySurvey(surveyId: string): Promise<SurveySummary> {
  try {
    const response = await api.get<{ code: number; message: string; data: SurveySummary }>(`/api/surveys/${surveyId}`);
    return response.data.data;
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function createSurvey(payload: SurveyPayload): Promise<SurveySummary> {
  try {
    const response = await api.post<{ code: number; message: string; data: SurveySummary }>('/api/surveys', payload);
    return response.data.data;
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function listQuestionTemplates(): Promise<QuestionTemplateSummary[]> {
  try {
    const response = await api.get<{ code: number; message: string; data: QuestionTemplateSummary[] }>('/api/questions');
    return response.data.data;
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function createQuestionTemplate(payload: QuestionTemplatePayload): Promise<QuestionTemplateSummary> {
  try {
    const response = await api.post<{ code: number; message: string; data: QuestionTemplateSummary }>('/api/questions', payload);
    return response.data.data;
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function getQuestionTemplateById(templateId: string): Promise<QuestionTemplateSummary> {
  try {
    const response = await api.get<{ code: number; message: string; data: QuestionTemplateSummary }>(`/api/questions/${templateId}`);
    return response.data.data;
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function updateQuestionTemplate(templateId: string, payload: QuestionTemplatePayload): Promise<QuestionTemplateSummary> {
  try {
    const response = await api.put<{ code: number; message: string; data: QuestionTemplateSummary }>(
      `/api/questions/${templateId}`,
      payload,
    );
    return response.data.data;
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function deleteQuestionTemplate(templateId: string): Promise<void> {
  try {
    await api.delete(`/api/questions/${templateId}`);
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function getQuestionTemplateShares(templateId: string): Promise<QuestionTemplateShareResult> {
  try {
    const response = await api.get<{ code: number; message: string; data: QuestionTemplateShareResult }>(
      `/api/questions/${templateId}/shares`,
    );
    return response.data.data;
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function updateQuestionTemplateShares(templateId: string, usernames: string[]): Promise<QuestionTemplateShareResult> {
  try {
    const response = await api.put<{ code: number; message: string; data: QuestionTemplateShareResult }>(
      `/api/questions/${templateId}/shares`,
      { usernames },
    );
    return response.data.data;
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function listQuestionTemplateVersions(templateId: string): Promise<QuestionTemplateSummary[]> {
  try {
    const response = await api.get<{ code: number; message: string; data: QuestionTemplateSummary[] }>(
      `/api/questions/${templateId}/versions`,
    );
    return response.data.data;
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function restoreQuestionTemplateVersion(templateId: string): Promise<QuestionTemplateSummary> {
  try {
    const response = await api.post<{ code: number; message: string; data: QuestionTemplateSummary }>(
      `/api/questions/${templateId}/restore`,
    );
    return response.data.data;
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function updateSurvey(surveyId: string, payload: SurveyPayload): Promise<SurveySummary> {
  try {
    const response = await api.put<{ code: number; message: string; data: SurveySummary }>(`/api/surveys/${surveyId}`, payload);
    return response.data.data;
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function publishSurvey(surveyId: string) {
  try {
    const response = await api.post<{ code: number; message: string; data: { survey: SurveySummary; shareLink: string } }>(
      `/api/surveys/${surveyId}/publish`,
    );
    return response.data.data;
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function closeSurvey(surveyId: string) {
  try {
    const response = await api.post<{ code: number; message: string; data: { survey: SurveySummary } }>(`/api/surveys/${surveyId}/close`);
    return response.data.data;
  } catch (error) {
    normalizeApiError(error);
  }
}

export async function getSurveyStatistics(surveyId: string): Promise<SurveyStatistics> {
  try {
    const response = await api.get<{ code: number; message: string; data: SurveyStatistics }>(`/api/statistics/surveys/${surveyId}`);
    return response.data.data;
  } catch (error) {
    normalizeApiError(error);
  }
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
