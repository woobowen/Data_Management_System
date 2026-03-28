import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';

import { FieldLabel, PageCard, PrimaryButton, SecondaryButton, SectionTitle, Select, TextArea, TextInput } from '../components/ui';
import { ApiClientError, createSurvey, getMySurvey, updateSurvey, type SurveyPayload, type SurveyQuestionInput } from '../lib/api';
import { createEmptyQuestion, createEmptySurveyPayload, surveyToPayload } from '../lib/survey-editor';

function normalizeQuestion(question: SurveyQuestionInput, order: number): SurveyQuestionInput {
  const options = question.type === 'single_choice' || question.type === 'multi_choice' ? question.options ?? [] : [];
  return {
    ...question,
    order,
    options,
    validation: question.validation ?? {},
    logicRules: question.logicRules ?? [],
    defaultNextQuestionId: question.defaultNextQuestionId ?? 'END',
  };
}

type EditorPageProps = { mode: 'create' | 'edit' };

export function EditorPage({ mode }: EditorPageProps) {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<SurveyPayload>(createEmptySurveyPayload());
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'edit' || !surveyId) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const survey = await getMySurvey(surveyId);
        if (!cancelled) {
          setForm(surveyToPayload(survey));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiClientError ? err.message : '加载问卷失败');
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
  }, [mode, surveyId]);

  const orderedQuestions = useMemo(
    () => form.questions.map((question, index) => normalizeQuestion(question, index + 1)),
    [form.questions],
  );

  const setQuestion = (index: number, updater: (question: SurveyQuestionInput) => SurveyQuestionInput) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question, questionIndex) =>
        questionIndex === index ? updater(normalizeQuestion(question, questionIndex + 1)) : normalizeQuestion(question, questionIndex + 1),
      ),
    }));
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        title={mode === 'create' ? '新建问卷' : '编辑问卷'}
        description="配置基础信息、题目、校验规则与跳转逻辑。"
        action={
          <Link to="/dashboard">
            <SecondaryButton>返回列表</SecondaryButton>
          </Link>
        }
      />
      {error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {loading ? (
        <PageCard className="p-8 text-sm text-slate-800">正在加载问卷…</PageCard>
      ) : (
        <>
          <PageCard className="p-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <FieldLabel>问卷标题</FieldLabel>
                <TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <FieldLabel>问卷说明</FieldLabel>
                <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
              </div>
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900">
                <input
                  type="checkbox"
                  checked={form.allowAnonymous}
                  onChange={(e) => setForm({ ...form, allowAnonymous: e.target.checked })}
                />
                允许匿名填写
              </label>
              <div>
                <FieldLabel>截止时间</FieldLabel>
                <TextInput
                  type="datetime-local"
                  value={form.deadlineAt ? form.deadlineAt.slice(0, 16) : ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      deadlineAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })
                  }
                />
              </div>
            </div>
          </PageCard>

          <div className="space-y-4">
            {orderedQuestions.map((question, index) => (
              <PageCard key={question.questionId} className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">题目 {index + 1}</h3>
                    <p className="mt-1 text-sm text-slate-700">配置题型、选项、校验范围与跳转规则。</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        questions: current.questions.filter((_, questionIndex) => questionIndex !== index).map(normalizeQuestion),
                      }))
                    }
                    className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  <div>
                    <FieldLabel>题目 ID</FieldLabel>
                    <TextInput value={question.questionId} onChange={(e) => setQuestion(index, (current) => ({ ...current, questionId: e.target.value }))} />
                  </div>
                  <div>
                    <FieldLabel>题型</FieldLabel>
                    <Select
                      value={question.type}
                      onChange={(e) =>
                        setQuestion(index, (current) => ({
                          ...current,
                          type: e.target.value as SurveyQuestionInput['type'],
                          options: e.target.value === 'single_choice' || e.target.value === 'multi_choice' ? current.options ?? [{ optionId: `${current.questionId}-a`, text: '' }] : [],
                          validation: {},
                          logicRules: [],
                        }))
                      }
                    >
                      <option value="single_choice">单选题</option>
                      <option value="multi_choice">多选题</option>
                      <option value="text">文本填空</option>
                      <option value="number">数字填空</option>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel>题目标题</FieldLabel>
                    <TextInput value={question.title} onChange={(e) => setQuestion(index, (current) => ({ ...current, title: e.target.value }))} />
                  </div>
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900">
                    <input
                      type="checkbox"
                      checked={question.isRequired}
                      onChange={(e) => setQuestion(index, (current) => ({ ...current, isRequired: e.target.checked }))}
                    />
                    设为必答题
                  </label>
                </div>

                {(question.type === 'single_choice' || question.type === 'multi_choice') && (
                  <div className="mt-6 space-y-4">
                    <SectionTitle
                      title="选项配置"
                      action={
                        <SecondaryButton
                          onClick={() =>
                            setQuestion(index, (current) => ({
                              ...current,
                              options: [...(current.options ?? []), { optionId: `${current.questionId}-${Date.now()}`, text: '' }],
                            }))
                          }
                        >
                          新增选项
                        </SecondaryButton>
                      }
                    />
                    {(question.options ?? []).map((option, optionIndex) => (
                      <div key={option.optionId} className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
                        <TextInput
                          value={option.optionId}
                          onChange={(e) =>
                            setQuestion(index, (current) => ({
                              ...current,
                              options: (current.options ?? []).map((item, itemIndex) =>
                                itemIndex === optionIndex ? { ...item, optionId: e.target.value } : item,
                              ),
                            }))
                          }
                          placeholder="optionId"
                        />
                        <TextInput
                          value={option.text}
                          onChange={(e) =>
                            setQuestion(index, (current) => ({
                              ...current,
                              options: (current.options ?? []).map((item, itemIndex) =>
                                itemIndex === optionIndex ? { ...item, text: e.target.value } : item,
                              ),
                            }))
                          }
                          placeholder="选项文本"
                        />
                        <SecondaryButton
                          onClick={() =>
                            setQuestion(index, (current) => ({
                              ...current,
                              options: (current.options ?? []).filter((_, itemIndex) => itemIndex !== optionIndex),
                            }))
                          }
                        >
                          删除
                        </SecondaryButton>
                      </div>
                    ))}
                    {question.type === 'multi_choice' ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <FieldLabel>最少选择</FieldLabel>
                          <TextInput
                            type="number"
                            value={question.validation?.minSelected ?? ''}
                            onChange={(e) =>
                              setQuestion(index, (current) => ({
                                ...current,
                                validation: {
                                  ...current.validation,
                                  minSelected: e.target.value === '' ? undefined : Number(e.target.value),
                                },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <FieldLabel>最多选择</FieldLabel>
                          <TextInput
                            type="number"
                            value={question.validation?.maxSelected ?? ''}
                            onChange={(e) =>
                              setQuestion(index, (current) => ({
                                ...current,
                                validation: {
                                  ...current.validation,
                                  maxSelected: e.target.value === '' ? undefined : Number(e.target.value),
                                },
                              }))
                            }
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {question.type === 'text' && (
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div>
                      <FieldLabel>最少字数</FieldLabel>
                      <TextInput
                        type="number"
                        value={question.validation?.minLength ?? ''}
                        onChange={(e) =>
                          setQuestion(index, (current) => ({
                            ...current,
                            validation: { ...current.validation, minLength: e.target.value === '' ? undefined : Number(e.target.value) },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <FieldLabel>最多字数</FieldLabel>
                      <TextInput
                        type="number"
                        value={question.validation?.maxLength ?? ''}
                        onChange={(e) =>
                          setQuestion(index, (current) => ({
                            ...current,
                            validation: { ...current.validation, maxLength: e.target.value === '' ? undefined : Number(e.target.value) },
                          }))
                        }
                      />
                    </div>
                  </div>
                )}

                {question.type === 'number' && (
                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <div>
                      <FieldLabel>最小值</FieldLabel>
                      <TextInput
                        type="number"
                        value={question.validation?.min ?? ''}
                        onChange={(e) =>
                          setQuestion(index, (current) => ({
                            ...current,
                            validation: { ...current.validation, min: e.target.value === '' ? undefined : Number(e.target.value) },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <FieldLabel>最大值</FieldLabel>
                      <TextInput
                        type="number"
                        value={question.validation?.max ?? ''}
                        onChange={(e) =>
                          setQuestion(index, (current) => ({
                            ...current,
                            validation: { ...current.validation, max: e.target.value === '' ? undefined : Number(e.target.value) },
                          }))
                        }
                      />
                    </div>
                    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900">
                      <input
                        type="checkbox"
                        checked={question.validation?.isInteger ?? false}
                        onChange={(e) =>
                          setQuestion(index, (current) => ({
                            ...current,
                            validation: { ...current.validation, isInteger: e.target.checked },
                          }))
                        }
                      />
                      必须为整数
                    </label>
                  </div>
                )}

                <div className="mt-6 space-y-4">
                  <SectionTitle
                    title="跳转逻辑"
                    description="按顺序判断 logicRules，未命中则走默认跳转。"
                    action={
                      <SecondaryButton
                        onClick={() =>
                          setQuestion(index, (current) => ({
                            ...current,
                            logicRules: [...(current.logicRules ?? []), { condition: 'eq', targetValue: '', nextQuestionId: 'END' }],
                          }))
                        }
                      >
                        新增规则
                      </SecondaryButton>
                    }
                  />
                  {(question.logicRules ?? []).map((rule, ruleIndex) => (
                    <div key={`${question.questionId}-rule-${ruleIndex}`} className="grid gap-3 md:grid-cols-[120px_1fr_1fr_auto]">
                      <Select
                        value={rule.condition}
                        onChange={(e) =>
                          setQuestion(index, (current) => ({
                            ...current,
                            logicRules: (current.logicRules ?? []).map((item, itemIndex) =>
                              itemIndex === ruleIndex ? { ...item, condition: e.target.value as typeof item.condition } : item,
                            ),
                          }))
                        }
                      >
                        <option value="eq">等于</option>
                        <option value="gt">大于</option>
                        <option value="lt">小于</option>
                        <option value="includes">包含</option>
                      </Select>
                      <TextInput
                        value={String(rule.targetValue ?? '')}
                        onChange={(e) =>
                          setQuestion(index, (current) => ({
                            ...current,
                            logicRules: (current.logicRules ?? []).map((item, itemIndex) =>
                              itemIndex === ruleIndex
                                ? {
                                    ...item,
                                    targetValue:
                                      current.type === 'number' && e.target.value !== ''
                                        ? Number(e.target.value)
                                        : e.target.value,
                                  }
                                : item,
                            ),
                          }))
                        }
                        placeholder="目标值"
                      />
                      <TextInput
                        value={rule.nextQuestionId}
                        onChange={(e) =>
                          setQuestion(index, (current) => ({
                            ...current,
                            logicRules: (current.logicRules ?? []).map((item, itemIndex) =>
                              itemIndex === ruleIndex ? { ...item, nextQuestionId: e.target.value } : item,
                            ),
                          }))
                        }
                        placeholder="跳转到 questionId 或 END"
                      />
                      <SecondaryButton
                        onClick={() =>
                          setQuestion(index, (current) => ({
                            ...current,
                            logicRules: (current.logicRules ?? []).filter((_, itemIndex) => itemIndex !== ruleIndex),
                          }))
                        }
                      >
                        删除
                      </SecondaryButton>
                    </div>
                  ))}
                  <div className="max-w-xs">
                    <FieldLabel>默认跳转</FieldLabel>
                    <TextInput
                      value={question.defaultNextQuestionId ?? 'END'}
                      onChange={(e) => setQuestion(index, (current) => ({ ...current, defaultNextQuestionId: e.target.value }))}
                      placeholder="END 或下一题 questionId"
                    />
                  </div>
                </div>
              </PageCard>
            ))}
          </div>

          <SecondaryButton
            onClick={() =>
              setForm((current) => ({
                ...current,
                questions: [...orderedQuestions, createEmptyQuestion(orderedQuestions.length + 1)],
              }))
            }
            className="inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            添加题目
          </SecondaryButton>

          <div className="flex justify-end gap-3">
            <SecondaryButton onClick={() => navigate('/dashboard')}>取消</SecondaryButton>
            <PrimaryButton
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                setError(null);
                try {
                  const payload: SurveyPayload = {
                    ...form,
                    questions: orderedQuestions,
                  };
                  const result = mode === 'create' ? await createSurvey(payload) : await updateSurvey(surveyId!, payload);
                  navigate(`/editor/${result._id}`, { replace: true });
                } catch (err) {
                  setError(err instanceof ApiClientError ? err.message : '保存失败');
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? '保存中…' : '保存问卷'}
            </PrimaryButton>
          </div>
        </>
      )}
    </div>
  );
}
