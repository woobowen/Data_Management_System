import { z } from 'zod';

const optionSchema = z.object({
  optionId: z.string().min(1),
  text: z.string().min(1),
});

const logicRuleSchema = z.object({
  condition: z.enum(['eq', 'gt', 'lt', 'includes']),
  targetValue: z.unknown(),
  nextQuestionId: z.string().min(1),
});

const questionValidationSchema = z.object({
  minSelected: z.number().int().nonnegative().optional(),
  maxSelected: z.number().int().nonnegative().optional(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().nonnegative().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  isInteger: z.boolean().optional(),
});

const optionalQuestionValidationSchema = questionValidationSchema.optional();

export const questionSchema = z.object({
  questionId: z.string().min(1),
  type: z.enum(['single_choice', 'multi_choice', 'text', 'number']),
  title: z.string().min(1),
  description: z.string().default(''),
  isRequired: z.boolean(),
  order: z.number().int().nonnegative(),
  options: z.array(optionSchema).optional(),
  validation: optionalQuestionValidationSchema,
  logicRules: z.array(logicRuleSchema).optional(),
  defaultNextQuestionId: z.string().min(1).optional(),
  questionTemplateId: z.string().min(1).optional(),
  questionTemplateVersion: z.number().int().positive().optional(),
});

export const surveyPayloadSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  allowAnonymous: z.boolean(),
  deadlineAt: z.string().datetime().optional().nullable(),
  questions: z.array(questionSchema).default([]),
});

export const questionTemplatePayloadSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  type: z.enum(['single_choice', 'multi_choice', 'text', 'number']),
  isRequired: z.boolean().default(false),
  options: z.array(optionSchema).default([]),
  validation: questionValidationSchema.default({}),
});

export const shareQuestionTemplateSchema = z.object({
  usernames: z.array(z.string().min(3)).default([]),
});

export const registerSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});

export const loginSchema = registerSchema;

export const submitAnswersSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      type: z.enum(['single_choice', 'multi_choice', 'text', 'number']),
      value: z.unknown(),
    }),
  ),
});
