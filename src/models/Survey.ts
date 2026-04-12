import { InferSchemaType, Schema, model } from 'mongoose';

const optionSchema = new Schema(
  {
    optionId: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false },
);

const logicRuleSchema = new Schema(
  {
    condition: { type: String, enum: ['eq', 'gt', 'lt', 'includes'], required: true },
    targetValue: { type: Schema.Types.Mixed, required: true },
    nextQuestionId: { type: String, required: true },
  },
  { _id: false },
);

const validationSchema = new Schema(
  {
    minSelected: Number,
    maxSelected: Number,
    minLength: Number,
    maxLength: Number,
    min: Number,
    max: Number,
    isInteger: Boolean,
  },
  { _id: false },
);

const questionSchema = new Schema(
  {
    questionId: { type: String, required: true },
    type: { type: String, enum: ['single_choice', 'multi_choice', 'text', 'number'], required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    isRequired: { type: Boolean, required: true, default: false },
    order: { type: Number, required: true },
    options: { type: [optionSchema], default: [] },
    validation: { type: validationSchema, default: {} },
    logicRules: { type: [logicRuleSchema], default: [] },
    defaultNextQuestionId: { type: String, default: 'END' },
    questionTemplateId: { type: String, default: null },
    questionTemplateVersion: { type: Number, default: null },
  },
  { _id: false },
);

const surveySchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'published', 'closed'], required: true, default: 'draft' },
    allowAnonymous: { type: Boolean, required: true, default: false },
    deadlineAt: { type: Date, default: null },
    questions: { type: [questionSchema], default: [] },
  },
  { versionKey: false, timestamps: true },
);

export type SurveyDocument = InferSchemaType<typeof surveySchema> & { _id: Schema.Types.ObjectId };

export const SurveyModel = model('Survey', surveySchema);
