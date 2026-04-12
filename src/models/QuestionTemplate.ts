import { InferSchemaType, Schema, model } from 'mongoose';

const optionSchema = new Schema(
  {
    optionId: { type: String, required: true },
    text: { type: String, required: true },
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

const questionTemplateSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rootTemplateId: { type: String, required: true, index: true },
    version: { type: Number, required: true, default: 1 },
    previousTemplateId: { type: Schema.Types.ObjectId, ref: 'QuestionTemplate', default: null },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['single_choice', 'multi_choice', 'text', 'number'], required: true },
    isRequired: { type: Boolean, required: true, default: false },
    options: { type: [optionSchema], default: [] },
    validation: { type: validationSchema, default: {} },
    sharedWithUserIds: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
  },
  { versionKey: false, timestamps: true },
);

questionTemplateSchema.index({ ownerId: 1, updatedAt: -1 });
questionTemplateSchema.index({ sharedWithUserIds: 1, updatedAt: -1 });
questionTemplateSchema.index({ rootTemplateId: 1, version: 1 }, { unique: true });

export type QuestionTemplateDocument = InferSchemaType<typeof questionTemplateSchema> & { _id: Schema.Types.ObjectId };

export const QuestionTemplateModel = model('QuestionTemplate', questionTemplateSchema);
