import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { createApp } from '../src/app';
import { connectDatabase, disconnectDatabase } from '../src/lib/db';
import { ResponseModel } from '../src/models/Response';
import { SurveyModel } from '../src/models/Survey';
import { UserModel } from '../src/models/User';

describe('survey backend integration', () => {
  const app = createApp();
  let mongoServer: MongoMemoryServer;
  let token = '';
  let surveyId = '';

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await connectDatabase(mongoServer.getUri());
  });

  afterEach(async () => {
    await Promise.all([UserModel.deleteMany({}), SurveyModel.deleteMany({}), ResponseModel.deleteMany({})]);
    token = '';
    surveyId = '';
  });

  afterAll(async () => {
    await disconnectDatabase();
    await mongoServer.stop();
  });

  const surveyPayload = {
    title: '职业调查',
    description: '第一阶段测试问卷',
    allowAnonymous: true,
    deadlineAt: null,
    questions: [
      {
        questionId: 'q1',
        type: 'single_choice',
        title: '你是否在职',
        isRequired: true,
        order: 1,
        options: [
          { optionId: 'optA', text: '是' },
          { optionId: 'optB', text: '否' },
        ],
        validation: {},
        logicRules: [
          { condition: 'eq', targetValue: 'optA', nextQuestionId: 'q2' },
          { condition: 'eq', targetValue: 'optB', nextQuestionId: 'q3' },
        ],
        defaultNextQuestionId: 'END',
      },
      {
        questionId: 'q2',
        type: 'number',
        title: '你的工龄',
        isRequired: true,
        order: 2,
        validation: { min: 0, max: 50, isInteger: true },
        logicRules: [],
        defaultNextQuestionId: 'END',
      },
      {
        questionId: 'q3',
        type: 'text',
        title: '请说明原因',
        isRequired: true,
        order: 3,
        validation: { minLength: 2, maxLength: 20 },
        logicRules: [],
        defaultNextQuestionId: 'END',
      },
    ],
  };

  const bootstrapSurvey = async () => {
    await request(app).post('/api/auth/register').send({ username: 'alice', password: 'password123' }).expect(201);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'password123' })
      .expect(200);

    token = loginResponse.body.data.token;

    const createResponse = await request(app)
      .post('/api/surveys')
      .set('Authorization', `Bearer ${token}`)
      .send(surveyPayload)
      .expect(201);

    surveyId = createResponse.body.data._id;

    await request(app)
      .post(`/api/surveys/${surveyId}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  };

  it('supports register -> create survey -> publish -> render', async () => {
    await bootstrapSurvey();

    const renderResponse = await request(app).get(`/api/surveys/${surveyId}/render`).expect(200);

    expect(renderResponse.body.data.status).toBe('published');
    expect(renderResponse.body.data.questions).toHaveLength(3);
    expect(renderResponse.body.data.ownerId).toBeUndefined();
    expect(renderResponse.body.data.surveyId).toBe(surveyId);
  });

  it('accepts valid submit path and returns statistics', async () => {
    await bootstrapSurvey();

    await request(app)
      .post(`/api/surveys/${surveyId}/submit`)
      .send({
        answers: [
          { questionId: 'q1', type: 'single_choice', value: 'optA' },
          { questionId: 'q2', type: 'number', value: 5 },
        ],
      })
      .expect(201);

    const statsResponse = await request(app)
      .get(`/api/statistics/surveys/${surveyId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const q1Stats = statsResponse.body.data.questions.find((item: { questionId: string }) => item.questionId === 'q1');
    const q2Stats = statsResponse.body.data.questions.find((item: { questionId: string }) => item.questionId === 'q2');

    expect(q1Stats.optionCounts).toEqual([{ questionId: 'q1', optionId: 'optA', count: 1 }]);
    expect(q1Stats.responseCount).toBe(1);
    expect(q2Stats.average).toBe(5);
  });

  it('rejects invalid validation values', async () => {
    await bootstrapSurvey();

    const response = await request(app)
      .post(`/api/surveys/${surveyId}/submit`)
      .send({
        answers: [
          { questionId: 'q1', type: 'single_choice', value: 'optA' },
          { questionId: 'q2', type: 'number', value: 100 },
        ],
      })
      .expect(400);

    expect(response.body.message).toContain('数字题高于最大值');
  });

  it('rejects ghost answers from illegal jump path', async () => {
    await bootstrapSurvey();

    const response = await request(app)
      .post(`/api/surveys/${surveyId}/submit`)
      .send({
        answers: [
          { questionId: 'q1', type: 'single_choice', value: 'optB' },
          { questionId: 'q2', type: 'number', value: 3 },
          { questionId: 'q3', type: 'text', value: '正在求职' },
        ],
      })
      .expect(400);

    expect(response.body.message).toContain('幽灵答案');
  });

  it('rejects anonymous submit when survey requires login', async () => {
    await request(app).post('/api/auth/register').send({ username: 'bob', password: 'password123' }).expect(201);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: 'bob', password: 'password123' })
      .expect(200);

    const authToken = loginResponse.body.data.token;

    const createResponse = await request(app)
      .post('/api/surveys')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ...surveyPayload, allowAnonymous: false })
      .expect(201);

    const securedSurveyId = createResponse.body.data._id;

    await request(app)
      .post(`/api/surveys/${securedSurveyId}/publish`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const response = await request(app)
      .post(`/api/surveys/${securedSurveyId}/submit`)
      .send({
        answers: [
          { questionId: 'q1', type: 'single_choice', value: 'optA' },
          { questionId: 'q2', type: 'number', value: 5 },
        ],
      })
      .expect(401);

    expect(response.body.message).toContain('登录');
  });
});
