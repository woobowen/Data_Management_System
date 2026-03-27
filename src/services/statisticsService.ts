import { Types } from 'mongoose';

import { ApiError } from '../lib/errors';
import { ResponseModel } from '../models/Response';
import { SurveyModel } from '../models/Survey';

export const getSurveyStatistics = async (ownerId: string, surveyId: string) => {
  const survey = await SurveyModel.findOne({ _id: surveyId, ownerId }).lean();
  if (!survey) {
    throw new ApiError(404, '问卷不存在');
  }

  const choiceBuckets = await ResponseModel.aggregate<{
    singles: {
      questionId: string;
      optionId: string;
      count: number;
    }[];
    multis: {
      questionId: string;
      optionId: string;
      count: number;
    }[];
  }>([
    { $match: { surveyId: new Types.ObjectId(surveyId), status: 'submitted' } },
    { $unwind: '$answers' },
    {
      $project: {
        questionId: '$answers.questionId',
        type: '$answers.type',
        value: '$answers.value',
      },
    },
    {
      $facet: {
        singles: [
          { $match: { type: 'single_choice' } },
          { $group: { _id: { questionId: '$questionId', optionId: '$value' }, count: { $sum: 1 } } },
          { $project: { _id: 0, questionId: '$_id.questionId', optionId: '$_id.optionId', count: 1 } },
        ],
        multis: [
          { $match: { type: 'multi_choice' } },
          { $unwind: '$value' },
          { $group: { _id: { questionId: '$questionId', optionId: '$value' }, count: { $sum: 1 } } },
          { $project: { _id: 0, questionId: '$_id.questionId', optionId: '$_id.optionId', count: 1 } },
        ],
      },
    },
  ]);

  const numericStats = await ResponseModel.aggregate<{
    questionId: string;
    avgValue: number;
  }>([
    { $match: { surveyId: new Types.ObjectId(surveyId), status: 'submitted' } },
    { $unwind: '$answers' },
    { $match: { 'answers.type': 'number' } },
    {
      $group: {
        _id: '$answers.questionId',
        avgValue: { $avg: '$answers.value' },
      },
    },
    { $project: { _id: 0, questionId: '$_id', avgValue: 1 } },
  ]);

  const textStats = await ResponseModel.aggregate<{
    questionId: string;
    values: string[];
  }>([
    { $match: { surveyId: new Types.ObjectId(surveyId), status: 'submitted' } },
    { $unwind: '$answers' },
    { $match: { 'answers.type': 'text' } },
    {
      $group: {
        _id: '$answers.questionId',
        values: { $push: '$answers.value' },
      },
    },
    { $project: { _id: 0, questionId: '$_id', values: 1 } },
  ]);

  const responseCounts = await ResponseModel.aggregate<{
    questionId: string;
    count: number;
  }>([
    { $match: { surveyId: new Types.ObjectId(surveyId), status: 'submitted' } },
    { $unwind: '$answers' },
    {
      $group: {
        _id: '$answers.questionId',
        count: { $sum: 1 },
      },
    },
    { $project: { _id: 0, questionId: '$_id', count: 1 } },
  ]);

  const allChoiceStats = choiceBuckets[0]
    ? [...choiceBuckets[0].singles, ...choiceBuckets[0].multis]
    : [];

  return {
    surveyId,
    questions: survey.questions.map((question) => {
      const choiceStats = allChoiceStats.filter((item) => item.questionId === question.questionId);
      const numberStat = numericStats.find((item) => item.questionId === question.questionId);
      const textStat = textStats.find((item) => item.questionId === question.questionId);
      const responseCount = responseCounts.find((item) => item.questionId === question.questionId);

      return {
        questionId: question.questionId,
        type: question.type,
        title: question.title,
        optionCounts: choiceStats,
        average: numberStat?.avgValue ?? null,
        responseCount: responseCount?.count ?? 0,
        textValues: textStat?.values ?? [],
      };
    }),
  };
};
