import { replayFromStart, type SurveyDefinition } from '../frontend/src/state/survey-engine';

describe('frontend survey engine replayFromStart', () => {
  it('keeps linear default path length before first answer', () => {
    const survey: SurveyDefinition = {
      surveyId: 's1',
      title: 'linear',
      description: '',
      allowAnonymous: true,
      questions: [
        {
          questionId: 'q1',
          type: 'single_choice',
          title: 'Q1',
          isRequired: true,
          order: 1,
          options: [
            { optionId: 'a', text: 'A' },
            { optionId: 'b', text: 'B' },
          ],
          logicRules: [],
          defaultNextQuestionId: 'q2',
        },
        {
          questionId: 'q2',
          type: 'single_choice',
          title: 'Q2',
          isRequired: false,
          order: 2,
          options: [{ optionId: 'c', text: 'C' }],
          logicRules: [],
          defaultNextQuestionId: 'END',
        },
      ],
    };

    const replay = replayFromStart({}, survey);

    expect(replay.canonicalPath).toEqual(['q1', 'q2']);
    expect(replay.currentReachableQuestionId).toBe('q1');
  });

  it('stops path expansion at first unanswered branching question', () => {
    const survey: SurveyDefinition = {
      surveyId: 's2',
      title: 'branch',
      description: '',
      allowAnonymous: true,
      questions: [
        {
          questionId: 'q1',
          type: 'single_choice',
          title: 'Q1',
          isRequired: true,
          order: 1,
          options: [
            { optionId: 'a', text: 'A' },
            { optionId: 'b', text: 'B' },
          ],
          logicRules: [{ condition: 'eq', targetValue: 'a', nextQuestionId: 'q2' }],
          defaultNextQuestionId: 'END',
        },
        {
          questionId: 'q2',
          type: 'text',
          title: 'Q2',
          isRequired: false,
          order: 2,
          logicRules: [],
          defaultNextQuestionId: 'END',
        },
      ],
    };

    const replay = replayFromStart({}, survey);

    expect(replay.canonicalPath).toEqual(['q1']);
    expect(replay.currentReachableQuestionId).toBe('q1');
  });

  it('keeps current page on first unanswered question after answered prefix', () => {
    const survey: SurveyDefinition = {
      surveyId: 's3',
      title: 'prefix',
      description: '',
      allowAnonymous: true,
      questions: [
        {
          questionId: 'q1',
          type: 'single_choice',
          title: 'Q1',
          isRequired: true,
          order: 1,
          options: [{ optionId: 'a', text: 'A' }],
          logicRules: [],
          defaultNextQuestionId: 'q2',
        },
        {
          questionId: 'q2',
          type: 'text',
          title: 'Q2',
          isRequired: true,
          order: 2,
          logicRules: [],
          defaultNextQuestionId: 'q3',
        },
        {
          questionId: 'q3',
          type: 'number',
          title: 'Q3',
          isRequired: false,
          order: 3,
          logicRules: [],
          defaultNextQuestionId: 'END',
        },
      ],
    };

    const replay = replayFromStart(
      {
        q1: { questionId: 'q1', type: 'single_choice', value: 'a' },
      },
      survey,
    );

    expect(replay.canonicalPath).toEqual(['q1', 'q2', 'q3']);
    expect(replay.currentReachableQuestionId).toBe('q2');
  });
});
