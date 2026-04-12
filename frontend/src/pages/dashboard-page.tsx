import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState, PageCard, PrimaryButton, SecondaryButton, SectionTitle } from '../components/ui';
import { ApiClientError, closeSurvey, listMySurveys, publishSurvey, type SurveySummary } from '../lib/api';

export function DashboardPage() {
  const [surveys, setSurveys] = useState<SurveySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      setSurveys(await listMySurveys());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '加载问卷失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="我的问卷"
        description="查看、编辑、发布、关闭并分发你的问卷。"
        action={
          <div className="flex gap-2">
            <Link to="/question-bank">
              <SecondaryButton>题库管理</SecondaryButton>
            </Link>
            <Link to="/editor/new">
              <PrimaryButton>新建问卷</PrimaryButton>
            </Link>
          </div>
        }
      />
      {error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {loading ? (
        <PageCard className="p-8 text-sm text-slate-800">正在加载问卷列表…</PageCard>
      ) : surveys.length === 0 ? (
        <EmptyState
          title="还没有问卷"
          description="先创建第一份问卷，再配置题目、跳转逻辑和分发链接。"
          action={
            <Link to="/editor/new">
              <PrimaryButton>去创建</PrimaryButton>
            </Link>
          }
        />
      ) : (
        <PageCard className="overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-800">
            <thead className="bg-slate-50 text-left text-slate-800">
              <tr>
                <th className="px-6 py-4 font-medium">标题</th>
                <th className="px-6 py-4 font-medium">状态</th>
                <th className="px-6 py-4 font-medium">匿名</th>
                <th className="px-6 py-4 font-medium">截止时间</th>
                <th className="px-6 py-4 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {surveys.map((survey) => (
                <tr key={survey._id}>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{survey.title}</div>
                    <div className="mt-1 max-w-md text-slate-700">{survey.description || '无说明'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{survey.status}</span>
                  </td>
                  <td className="px-6 py-4">{survey.allowAnonymous ? '允许' : '需登录'}</td>
                  <td className="px-6 py-4">{survey.deadlineAt ? new Date(survey.deadlineAt).toLocaleString() : '未设置'}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Link to={`/editor/${survey._id}`}>
                        <SecondaryButton>编辑</SecondaryButton>
                      </Link>
                      <Link to={`/stats/${survey._id}`}>
                        <SecondaryButton>统计</SecondaryButton>
                      </Link>
                      <a href={`/survey/${survey._id}`} target="_blank" rel="noreferrer">
                        <SecondaryButton>填写链接</SecondaryButton>
                      </a>
                      {survey.status === 'draft' ? (
                        <PrimaryButton
                          onClick={async () => {
                            await publishSurvey(survey._id);
                            await reload();
                          }}
                        >
                          发布
                        </PrimaryButton>
                      ) : null}
                      {survey.status === 'published' ? (
                        <SecondaryButton
                          onClick={async () => {
                            await closeSurvey(survey._id);
                            await reload();
                          }}
                        >
                          关闭
                        </SecondaryButton>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PageCard>
      )}
    </div>
  );
}
