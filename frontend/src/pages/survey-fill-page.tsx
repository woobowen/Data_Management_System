import { useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { SurveyProvider } from '../state/survey-context';

export function SurveyFillPage({ children }: { children: React.ReactNode }) {
  const { surveyId } = useParams();
  const providerKey = useMemo(() => surveyId ?? 'missing-survey', [surveyId]);

  if (!surveyId) {
    return <Navigate to="/dashboard" replace />;
  }

  return <SurveyProvider key={providerKey}>{children}</SurveyProvider>;
}
