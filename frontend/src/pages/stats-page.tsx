import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { EmptyState, PageCard, SecondaryButton, SectionTitle } from '../components/ui';
import { ApiClientError, getMySurvey, getSurveyStatistics, type SurveyStatistics, type SurveySummary } from '../lib/api';

export function StatsPage() {
  const { surveyId } = useParams();
  const [survey, setSurvey] = useState<SurveySummary | null>(null);
  const [stats, setStats] = useState<SurveyStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!surveyId) {
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [surveyData, statsData] = await Promise.all([getMySurvey(surveyId), getSurveyStatistics(surveyId)]);
        if (!cancelled) {
          setSurvey(surveyData);
          setStats(statsData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiClientError ? err.message : '加载统计失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [surveyId]);

  return (
    <div className="space-y-6">
      <SectionTitle
        title={survey ? `${survey.title} - 统计结果` : '统计结果'}
        description="查看整份问卷与每道题目的聚合结果。"
        action={
          surveyId ? (
            <Link to={`/editor/${surveyId}`}>
              <SecondaryButton>返回编辑器</SecondaryButton>
            </Link>
          ) : null
        }
      />
      {error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {loading ? (
        <PageCard className="p-8 text-sm text-slate-800">正在加载统计…</PageCard>
      ) : !stats || stats.questions.length === 0 ? (
        <EmptyState title="暂无统计结果" description="在问卷收到答卷后，这里会自动展示各题的汇总数据。" />
      ) : (
        <div className="space-y-4">
          {stats.questions.map((question) => (
            <PageCard key={question.questionId} className="p-6">
              <h3 className="text-base font-semibold text-slate-900">{question.title}</h3>
              <p className="mt-1 text-sm text-slate-700">
                题目 ID：{question.questionId} · 题型：{question.type} · 响应数：{question.responseCount}
              </p>
              {question.optionCounts.length ? (
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-800">
                    <thead className="bg-slate-50 text-left text-slate-800">
                      <tr>
                        <th className="px-4 py-3 font-medium">选项</th>
                        <th className="px-4 py-3 font-medium">次数</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {question.optionCounts.map((item) => (
                        <tr key={`${item.questionId}-${item.optionId}`}>
                          <td className="px-4 py-3">{item.optionId}</td>
                          <td className="px-4 py-3">{item.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {question.average !== null ? <div className="mt-4 text-sm text-slate-700">平均值：{question.average}</div> : null}
              {question.textValues.length ? (
                <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="font-medium text-slate-900">文本作答</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {question.textValues.map((value, index) => (
                      <li key={`${question.questionId}-text-${index}`}>{value}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </PageCard>
          ))}
        </div>
      )}
    </div>
  );
}
