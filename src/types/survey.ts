export type SurveyStatus = 'draft' | 'published' | 'closed';
export type ResponseStatus = 'in_progress' | 'submitted';
export type QuestionType = 'single_choice' | 'multi_choice' | 'text' | 'number';
export type RuleCondition = 'eq' | 'gt' | 'lt' | 'includes';

export interface OptionValue {
  optionId: string;
  text: string;
}

export interface LogicRuleValue {
  condition: RuleCondition;
  targetValue: unknown;
  nextQuestionId: string;
}

export interface QuestionValidation {
  minSelected?: number;
  maxSelected?: number;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  isInteger?: boolean;
}

export interface QuestionValue {
  questionId: string;
  type: QuestionType;
  title: string;
  description?: string;
  isRequired: boolean;
  order: number;
  options?: OptionValue[];
  validation?: QuestionValidation;
  logicRules?: LogicRuleValue[];
  defaultNextQuestionId?: string;
  questionTemplateId?: string;
  questionTemplateVersion?: number;
}

export interface AnswerValue {
  questionId: string;
  type: QuestionType;
  value?: unknown;
}
