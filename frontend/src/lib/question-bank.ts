import type { QuestionTemplateSummary } from './api';

const PICKED_TEMPLATE_STORAGE_KEY = 'survey-question-bank-picked-template';

export function stashPickedTemplate(template: QuestionTemplateSummary) {
  window.sessionStorage.setItem(PICKED_TEMPLATE_STORAGE_KEY, JSON.stringify(template));
}

export function consumePickedTemplate(): QuestionTemplateSummary | null {
  const raw = window.sessionStorage.getItem(PICKED_TEMPLATE_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  window.sessionStorage.removeItem(PICKED_TEMPLATE_STORAGE_KEY);
  try {
    return JSON.parse(raw) as QuestionTemplateSummary;
  } catch {
    return null;
  }
}
