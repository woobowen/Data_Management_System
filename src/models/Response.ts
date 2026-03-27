import { InferSchemaType, Schema, model } from 'mongoose';

const answerSchema = new Schema(
  {
    questionId: { type: String, required: true },
    type: { type: String, enum: ['single_choice', 'multi_choice', 'text', 'number'], required: true },
    value: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const responseSchema = new Schema(
  {
    surveyId: { type: Schema.Types.ObjectId, ref: 'Survey', required: true, index: true },
    respondentId: { type: String, required: true, index: true },
    status: { type: String, enum: ['in_progress', 'submitted'], required: true, default: 'submitted' },
    submittedAt: { type: Date, default: null },
    answers: { type: [answerSchema], default: [] },
  },
  { versionKey: false, timestamps: true },
);

export type ResponseDocument = InferSchemaType<typeof responseSchema> & { _id: Schema.Types.ObjectId };

export const ResponseModel = model('Response', responseSchema);
