import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';

import { useAuth } from '../contexts/auth-context';
import {
  ApiClientError,
  createQuestionTemplate,
  deleteQuestionTemplate,
  getQuestionTemplateShares,
  listQuestionTemplateVersions,
  listQuestionTemplates,
  restoreQuestionTemplateVersion,
  updateQuestionTemplateShares,
  updateQuestionTemplate,
  type QuestionTemplatePayload,
  type QuestionTemplateSummary,
} from '../lib/api';
import { stashPickedTemplate } from '../lib/question-bank';
import { FieldLabel, PageCard, PrimaryButton, SecondaryButton, SectionTitle, Select, TextArea, TextInput } from '../components/ui';

const createEmptyTemplateForm = (): QuestionTemplatePayload => ({
  title: '',
  description: '',
  type: 'single_choice',
  isRequired: false,
  options: [
    { optionId: 'opt-a', text: '' },
    { optionId: 'opt-b', text: '' },
  ],
  validation: {},
});

const typeLabelMap: Record<QuestionTemplateSummary['type'], string> = {
  single_choice: '单选题',
  multi_choice: '多选题',
  text: '文本题',
  number: '数字题',
};

function toTemplateForm(template: QuestionTemplateSummary): QuestionTemplatePayload {
  return {
    title: template.title,
    description: template.description ?? '',
    type: template.type,
    isRequired: template.isRequired,
    options: (template.options ?? []).map((option) => ({ optionId: option.optionId, text: option.text })),
    validation: { ...(template.validation ?? {}) },
  };
}

function renderValidationSummary(template: QuestionTemplateSummary) {
  if (template.type === 'multi_choice') {
    const min = template.validation?.minSelected;
    const max = template.validation?.maxSelected;
    if (min === undefined && max === undefined) {
      return '多选数量：未设置限制';
    }
    return `多选数量：${min ?? 0} - ${max ?? '∞'}`;
  }

  if (template.type === 'text') {
    const min = template.validation?.minLength;
    const max = template.validation?.maxLength;
    if (min === undefined && max === undefined) {
      return '文本长度：未设置限制';
    }
    return `文本长度：${min ?? 0} - ${max ?? '∞'}`;
  }

  if (template.type === 'number') {
    const min = template.validation?.min;
    const max = template.validation?.max;
    const integerLabel = template.validation?.isInteger ? '，仅整数' : '';
    if (min === undefined && max === undefined) {
      return `数值范围：未设置限制${integerLabel}`;
    }
    return `数值范围：${min ?? '-∞'} - ${max ?? '∞'}${integerLabel}`;
  }

  return '单选题：请选择一个选项';
}

export function QuestionBankPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<QuestionTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [sharingTemplateId, setSharingTemplateId] = useState<string | null>(null);
  const [historyTemplateId, setHistoryTemplateId] = useState<string | null>(null);
  const [sharingInput, setSharingInput] = useState('');
  const [sharingLoading, setSharingLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sharedUsernamesByTemplate, setSharedUsernamesByTemplate] = useState<Record<string, string[]>>({});
  const [versionHistoryByTemplate, setVersionHistoryByTemplate] = useState<Record<string, QuestionTemplateSummary[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [form, setForm] = useState<QuestionTemplatePayload>(createEmptyTemplateForm());

  const isPickMode = searchParams.get('mode') === 'pick';
  const returnToRaw = searchParams.get('returnTo') || '/editor/new';
  const returnToPath = returnToRaw.startsWith('/') ? returnToRaw : '/editor/new';

  const reloadTemplates = async () => {
    if (!user?.id) {
      return;
    }
    setLoading(true);
    try {
      const data = await listQuestionTemplates();
      setTemplates(data);
      const ownerTemplateIds = data
        .filter((template) => String(template.ownerId) === user.id)
        .map((template) => template._id);

      if (ownerTemplateIds.length > 0) {
        const shareEntries = await Promise.all(
          ownerTemplateIds.map(async (templateId) => {
            try {
              const shareData = await getQuestionTemplateShares(templateId);
              return [templateId, shareData.usernames] as const;
            } catch {
              return [templateId, []] as const;
            }
          }),
        );
        setSharedUsernamesByTemplate(Object.fromEntries(shareEntries));
      } else {
        setSharedUsernamesByTemplate({});
      }
      setError(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '加载题库失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) {
      return;
    }
    void reloadTemplates();
  }, [user?.id]);

  const orderedTemplates = useMemo(
    () =>
      [...templates].sort((left, right) => {
        const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
        const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
        return rightTime - leftTime;
      }),
    [templates],
  );

  const submitForm = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: QuestionTemplatePayload = {
        ...form,
        options:
          form.type === 'single_choice' || form.type === 'multi_choice'
            ? (form.options ?? []).map((option) => ({
                optionId: option.optionId,
                text: option.text,
              }))
            : [],
        validation: { ...(form.validation ?? {}) },
      };

      if (editingTemplateId) {
        const updated = await updateQuestionTemplate(editingTemplateId, payload);
        await reloadTemplates();
        setInfoMessage(`题库题目已生成新版本：${updated.title}（v${updated.version}）`);
      } else {
        const created = await createQuestionTemplate(payload);
        setTemplates((current) => [created, ...current]);
        setSharedUsernamesByTemplate((current) => ({ ...current, [created._id]: [] }));
        setInfoMessage(`题库题目已创建：${created.title}`);
      }
      setEditingTemplateId(null);
      setForm(createEmptyTemplateForm());
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '保存题目失败');
    } finally {
      setSaving(false);
    }
  };

  const parseShareInput = (value: string) =>
    [...new Set(value.split(/[,\n，\s]+/).map((item) => item.trim()).filter((item) => item.length > 0))];

  const openShareEditor = async (templateId: string) => {
    setError(null);
    setInfoMessage(null);
    setSharingTemplateId(templateId);
    setSharingLoading(true);
    try {
      const shareData = await getQuestionTemplateShares(templateId);
      setSharedUsernamesByTemplate((current) => ({ ...current, [templateId]: shareData.usernames }));
      setSharingInput(shareData.usernames.join(', '));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '加载共享列表失败');
      setSharingTemplateId(null);
    } finally {
      setSharingLoading(false);
    }
  };

  const submitShareSettings = async (templateId: string) => {
    setError(null);
    setInfoMessage(null);
    setSharingLoading(true);
    try {
      const usernames = parseShareInput(sharingInput);
      const result = await updateQuestionTemplateShares(templateId, usernames);
      setSharedUsernamesByTemplate((current) => ({ ...current, [templateId]: result.usernames }));
      setInfoMessage(`共享设置已更新，当前共享 ${result.usernames.length} 位用户。`);
      setSharingTemplateId(null);
      setSharingInput('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '更新共享设置失败');
    } finally {
      setSharingLoading(false);
    }
  };

  const openHistoryPanel = async (templateId: string) => {
    setError(null);
    setInfoMessage(null);
    setHistoryTemplateId(templateId);
    setHistoryLoading(true);
    try {
      const versions = await listQuestionTemplateVersions(templateId);
      setVersionHistoryByTemplate((current) => ({ ...current, [templateId]: versions }));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '加载版本历史失败');
      setHistoryTemplateId(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  const restoreFromHistory = async (targetTemplateId: string, historyRootTemplateId: string) => {
    setError(null);
    setInfoMessage(null);
    setHistoryLoading(true);
    try {
      const restored = await restoreQuestionTemplateVersion(targetTemplateId);
      await reloadTemplates();
      const versions = await listQuestionTemplateVersions(historyRootTemplateId);
      setVersionHistoryByTemplate((current) => ({ ...current, [historyRootTemplateId]: versions }));
      setInfoMessage(`已从历史版本恢复并生成新版本：${restored.title}（v${restored.version}）`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '恢复历史版本失败');
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        title="题库管理"
        description={
          isPickMode
            ? '正在选题模式：请先预览题目，再选择要插入到问卷的题目。'
            : '在这里集中维护常用题目，支持增删改查与预览。'
        }
        action={
          <div className="flex gap-2">
            {isPickMode ? (
              <Link to={returnToPath}>
                <SecondaryButton>返回问卷编辑</SecondaryButton>
              </Link>
            ) : (
              <Link to="/dashboard">
                <SecondaryButton>返回问卷主页</SecondaryButton>
              </Link>
            )}
          </div>
        }
      />

      {error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {infoMessage ? <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{infoMessage}</div> : null}

      <PageCard className="p-6">
        <SectionTitle title={editingTemplateId ? '编辑题库题目' : '新建题库题目'} description="可独立创建常用题目，不依赖问卷编辑流程。" />
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <FieldLabel>题目标题</FieldLabel>
            <TextInput value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <FieldLabel>题目备注</FieldLabel>
            <TextArea
              rows={3}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="用于记录题目背景、解释说明或使用建议"
            />
          </div>
          <div>
            <FieldLabel>题型</FieldLabel>
            <Select
              value={form.type}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  type: event.target.value as QuestionTemplateSummary['type'],
                  options:
                    event.target.value === 'single_choice' || event.target.value === 'multi_choice'
                      ? current.options && current.options.length > 0
                        ? current.options
                        : [
                            { optionId: 'opt-a', text: '' },
                            { optionId: 'opt-b', text: '' },
                          ]
                      : [],
                  validation: {},
                }))
              }
            >
              <option value="single_choice">单选题</option>
              <option value="multi_choice">多选题</option>
              <option value="text">文本题</option>
              <option value="number">数字题</option>
            </Select>
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900">
            <input
              type="checkbox"
              checked={form.isRequired}
              onChange={(event) => setForm((current) => ({ ...current, isRequired: event.target.checked }))}
            />
            设为必答题
          </label>
        </div>

        {(form.type === 'single_choice' || form.type === 'multi_choice') && (
          <div className="mt-6 space-y-4">
            <SectionTitle
              title="选项配置"
              action={
                <SecondaryButton
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      options: [...(current.options ?? []), { optionId: `opt-${Date.now()}`, text: '' }],
                    }))
                  }
                >
                  新增选项
                </SecondaryButton>
              }
            />
            {(form.options ?? []).map((option, optionIndex) => (
              <div key={`${option.optionId}-${optionIndex}`} className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
                <TextInput
                  value={option.optionId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      options: (current.options ?? []).map((item, itemIndex) =>
                        itemIndex === optionIndex ? { ...item, optionId: event.target.value } : item,
                      ),
                    }))
                  }
                  placeholder="optionId"
                />
                <TextInput
                  value={option.text}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      options: (current.options ?? []).map((item, itemIndex) =>
                        itemIndex === optionIndex ? { ...item, text: event.target.value } : item,
                      ),
                    }))
                  }
                  placeholder="选项文本"
                />
                <SecondaryButton
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      options: (current.options ?? []).filter((_, itemIndex) => itemIndex !== optionIndex),
                    }))
                  }
                >
                  删除
                </SecondaryButton>
              </div>
            ))}
          </div>
        )}

        {form.type === 'multi_choice' && (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>最少选择</FieldLabel>
              <TextInput
                type="number"
                value={form.validation?.minSelected ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    validation: {
                      ...current.validation,
                      minSelected: event.target.value === '' ? undefined : Number(event.target.value),
                    },
                  }))
                }
              />
            </div>
            <div>
              <FieldLabel>最多选择</FieldLabel>
              <TextInput
                type="number"
                value={form.validation?.maxSelected ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    validation: {
                      ...current.validation,
                      maxSelected: event.target.value === '' ? undefined : Number(event.target.value),
                    },
                  }))
                }
              />
            </div>
          </div>
        )}

        {form.type === 'text' && (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>最少字数</FieldLabel>
              <TextInput
                type="number"
                value={form.validation?.minLength ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    validation: {
                      ...current.validation,
                      minLength: event.target.value === '' ? undefined : Number(event.target.value),
                    },
                  }))
                }
              />
            </div>
            <div>
              <FieldLabel>最多字数</FieldLabel>
              <TextInput
                type="number"
                value={form.validation?.maxLength ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    validation: {
                      ...current.validation,
                      maxLength: event.target.value === '' ? undefined : Number(event.target.value),
                    },
                  }))
                }
              />
            </div>
          </div>
        )}

        {form.type === 'number' && (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div>
              <FieldLabel>最小值</FieldLabel>
              <TextInput
                type="number"
                value={form.validation?.min ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    validation: {
                      ...current.validation,
                      min: event.target.value === '' ? undefined : Number(event.target.value),
                    },
                  }))
                }
              />
            </div>
            <div>
              <FieldLabel>最大值</FieldLabel>
              <TextInput
                type="number"
                value={form.validation?.max ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    validation: {
                      ...current.validation,
                      max: event.target.value === '' ? undefined : Number(event.target.value),
                    },
                  }))
                }
              />
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900">
              <input
                type="checkbox"
                checked={form.validation?.isInteger ?? false}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    validation: {
                      ...current.validation,
                      isInteger: event.target.checked,
                    },
                  }))
                }
              />
              必须为整数
            </label>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <PrimaryButton disabled={saving} onClick={() => void submitForm()}>
            {saving ? '保存中…' : editingTemplateId ? '保存修改' : '创建题库题目'}
          </PrimaryButton>
          {editingTemplateId ? (
            <SecondaryButton
              onClick={() => {
                setEditingTemplateId(null);
                setForm(createEmptyTemplateForm());
              }}
            >
              取消编辑
            </SecondaryButton>
          ) : null}
        </div>
      </PageCard>

      {loading ? (
        <PageCard className="p-8 text-sm text-slate-800">正在加载题库列表…</PageCard>
      ) : orderedTemplates.length === 0 ? (
        <PageCard className="p-8 text-sm text-slate-700">题库暂无题目，请先创建一条常用题目。</PageCard>
      ) : (
        <div className="space-y-4">
          {orderedTemplates.map((template) => {
            const isOwner = String(template.ownerId) === user?.id;
            const sharedUsernames = sharedUsernamesByTemplate[template._id] ?? [];

            return (
              <PageCard key={template._id} className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {template.title} <span className="text-slate-500">（v{template.version}）</span>
                    </h3>
                    <p className="mt-1 text-sm text-slate-700">
                      题型：{typeLabelMap[template.type]} · {template.isRequired ? '必答题' : '非必答题'} ·{' '}
                      {isOwner ? '我创建的题目' : '共享题目'}
                    </p>
                    {template.description ? <p className="mt-2 text-sm text-slate-700">{template.description}</p> : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {isPickMode ? (
                      <PrimaryButton
                        onClick={() => {
                          stashPickedTemplate(template);
                          navigate(returnToPath);
                        }}
                      >
                        选择并返回问卷
                      </PrimaryButton>
                    ) : null}
                    {isOwner ? (
                      <>
                        <SecondaryButton
                          onClick={() => {
                            setEditingTemplateId(template._id);
                            setForm(toTemplateForm(template));
                          }}
                        >
                          编辑
                        </SecondaryButton>
                        <SecondaryButton
                          disabled={sharingLoading && sharingTemplateId === template._id}
                          onClick={() => void openShareEditor(template._id)}
                        >
                          共享
                        </SecondaryButton>
                        <SecondaryButton
                          disabled={historyLoading && historyTemplateId === template._id}
                          onClick={() => void openHistoryPanel(template._id)}
                        >
                          版本历史
                        </SecondaryButton>
                        <SecondaryButton
                          disabled={deletingTemplateId === template._id}
                          onClick={async () => {
                            if (!window.confirm('确认删除该题库题目吗？')) {
                              return;
                            }
                            setDeletingTemplateId(template._id);
                            setError(null);
                            try {
                              await deleteQuestionTemplate(template._id);
                              setTemplates((current) => current.filter((item) => item._id !== template._id));
                              setSharedUsernamesByTemplate((current) => {
                                const next = { ...current };
                                delete next[template._id];
                                return next;
                              });
                              if (editingTemplateId === template._id) {
                                setEditingTemplateId(null);
                                setForm(createEmptyTemplateForm());
                              }
                            } catch (err) {
                              setError(err instanceof ApiClientError ? err.message : '删除题目失败');
                            } finally {
                              setDeletingTemplateId(null);
                            }
                          }}
                          className="inline-flex items-center gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          删除
                        </SecondaryButton>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{renderValidationSummary(template)}</div>

                {isOwner ? (
                  <div className="mt-4 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                    <div className="font-medium text-slate-900">共享对象</div>
                    <div className="mt-1">
                      {sharedUsernames.length > 0 ? sharedUsernames.join('、') : '暂无（点击“共享”可设置）'}
                    </div>
                  </div>
                ) : null}

                {isOwner && sharingTemplateId === template._id ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <FieldLabel>共享用户名</FieldLabel>
                    <TextArea
                      rows={3}
                      value={sharingInput}
                      onChange={(event) => setSharingInput(event.target.value)}
                      placeholder="输入用户名，多个请用逗号、空格或换行分隔"
                    />
                    <p className="mt-2 text-xs text-slate-600">留空后保存表示取消全部共享。</p>
                    <div className="mt-3 flex gap-2">
                      <PrimaryButton disabled={sharingLoading} onClick={() => void submitShareSettings(template._id)}>
                        {sharingLoading ? '保存中…' : '保存共享设置'}
                      </PrimaryButton>
                      <SecondaryButton
                        onClick={() => {
                          setSharingTemplateId(null);
                          setSharingInput('');
                        }}
                      >
                        取消
                      </SecondaryButton>
                    </div>
                  </div>
                ) : null}

                {isOwner && historyTemplateId === template._id ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 text-sm font-medium text-slate-900">版本历史</div>
                    {historyLoading ? (
                      <div className="text-sm text-slate-700">正在加载版本历史…</div>
                    ) : (versionHistoryByTemplate[template._id] ?? []).length === 0 ? (
                      <div className="text-sm text-slate-700">暂无历史版本记录。</div>
                    ) : (
                      <div className="space-y-2">
                        {(versionHistoryByTemplate[template._id] ?? []).map((version) => (
                          <div
                            key={version._id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                          >
                            <div className="text-sm text-slate-700">
                              <span className="font-medium text-slate-900">v{version.version}</span> · {version.title}
                              {version.previousTemplateId ? (
                                <span className="ml-2 text-xs text-slate-500">来源版本ID：{version.previousTemplateId}</span>
                              ) : (
                                <span className="ml-2 text-xs text-slate-500">初始版本</span>
                              )}
                            </div>
                            <SecondaryButton
                              disabled={historyLoading}
                              onClick={() => void restoreFromHistory(version._id, template._id)}
                            >
                              恢复为新版本
                            </SecondaryButton>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-3">
                      <SecondaryButton onClick={() => setHistoryTemplateId(null)}>关闭历史面板</SecondaryButton>
                    </div>
                  </div>
                ) : null}

                {(template.type === 'single_choice' || template.type === 'multi_choice') && template.options.length > 0 ? (
                  <div className="mt-4 rounded-xl border border-slate-200 p-4">
                    <div className="mb-2 text-sm font-medium text-slate-900">选项预览</div>
                    <ul className="space-y-1 text-sm text-slate-700">
                      {template.options.map((option) => (
                        <li key={`${template._id}-${option.optionId}`} className="flex items-center gap-2">
                          <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700">{option.optionId}</span>
                          <span>{option.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </PageCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
