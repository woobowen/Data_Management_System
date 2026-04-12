import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { createApp } from '../src/app';
import { connectDatabase, disconnectDatabase } from '../src/lib/db';
import { QuestionTemplateModel } from '../src/models/QuestionTemplate';
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
    await Promise.all([
      UserModel.deleteMany({}),
      SurveyModel.deleteMany({}),
      ResponseModel.deleteMany({}),
      QuestionTemplateModel.deleteMany({}),
    ]);
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
        description: '用于分流在职与非在职人群',
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
        description: '单位：年',
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
        description: '简要说明当前状态',
        isRequired: true,
        order: 3,
        validation: { minLength: 2, maxLength: 20 },
        logicRules: [],
        defaultNextQuestionId: 'END',
      },
    ],
  };

  const questionTemplatePayload = {
    title: '你的年龄',
    description: '常用于基础画像统计',
    type: 'number',
    isRequired: true,
    options: [],
    validation: {
      min: 0,
      max: 120,
      isInteger: true,
    },
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
    expect(renderResponse.body.data.questions[0].description).toContain('分流');
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

  it('supports question bank save and reuse metadata in surveys', async () => {
    await request(app).post('/api/auth/register').send({ username: 'charlie', password: 'password123' }).expect(201);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: 'charlie', password: 'password123' })
      .expect(200);

    token = loginResponse.body.data.token;

    const templateResponse = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${token}`)
      .send(questionTemplatePayload)
      .expect(201);

    const templateId = templateResponse.body.data._id;
    const templateVersion = templateResponse.body.data.version;

    const listResponse = await request(app).get('/api/questions').set('Authorization', `Bearer ${token}`).expect(200);
    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.data[0]._id).toBe(templateId);
    expect(listResponse.body.data[0].description).toBe(questionTemplatePayload.description);

    const surveyA = {
      title: '题库复用问卷 A',
      description: '使用题库题目',
      allowAnonymous: true,
      deadlineAt: null,
      questions: [
        {
          questionId: 'qAgeA',
          type: 'number',
          title: '你的年龄',
          description: '来自题库模板',
          isRequired: true,
          order: 1,
          options: [],
          validation: { min: 0, max: 120, isInteger: true },
          logicRules: [],
          defaultNextQuestionId: 'END',
          questionTemplateId: templateId,
          questionTemplateVersion: templateVersion,
        },
      ],
    };

    const surveyB = {
      ...surveyA,
      title: '题库复用问卷 B',
      questions: surveyA.questions.map((question) => ({ ...question, questionId: 'qAgeB' })),
    };

    const createSurveyAResponse = await request(app)
      .post('/api/surveys')
      .set('Authorization', `Bearer ${token}`)
      .send(surveyA)
      .expect(201);

    const createSurveyBResponse = await request(app)
      .post('/api/surveys')
      .set('Authorization', `Bearer ${token}`)
      .send(surveyB)
      .expect(201);

    expect(createSurveyAResponse.body.data.questions[0].questionTemplateId).toBe(templateId);
    expect(createSurveyBResponse.body.data.questions[0].questionTemplateId).toBe(templateId);
    expect(createSurveyAResponse.body.data.questions[0].questionTemplateVersion).toBe(templateVersion);
    expect(createSurveyBResponse.body.data.questions[0].questionTemplateVersion).toBe(templateVersion);
  });

  it('supports question bank CRUD operations for owner', async () => {
    await request(app).post('/api/auth/register').send({ username: 'diana', password: 'password123' }).expect(201);
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: 'diana', password: 'password123' })
      .expect(200);
    const authToken = loginResponse.body.data.token;

    const createResponse = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${authToken}`)
      .send(questionTemplatePayload)
      .expect(201);
    const templateId = createResponse.body.data._id;
    expect(createResponse.body.data.version).toBe(1);

    const getResponse = await request(app)
      .get(`/api/questions/${templateId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    expect(getResponse.body.data.title).toBe('你的年龄');

    const updateResponse = await request(app)
      .put(`/api/questions/${templateId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        ...questionTemplatePayload,
        title: '你的真实年龄',
        description: '更新后的描述',
      })
      .expect(200);
    const updatedTemplateId = updateResponse.body.data._id;
    expect(updatedTemplateId).not.toBe(templateId);
    expect(updateResponse.body.data.version).toBe(2);
    expect(updateResponse.body.data.previousTemplateId).toBe(templateId);
    expect(updateResponse.body.data.title).toBe('你的真实年龄');
    expect(updateResponse.body.data.description).toBe('更新后的描述');

    const oldVersionResponse = await request(app)
      .get(`/api/questions/${templateId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    expect(oldVersionResponse.body.data.version).toBe(1);
    expect(oldVersionResponse.body.data.title).toBe('你的年龄');

    const versionListResponse = await request(app)
      .get(`/api/questions/${templateId}/versions`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    expect(versionListResponse.body.data.map((item: { version: number }) => item.version)).toEqual([2, 1]);

    const restoreResponse = await request(app)
      .post(`/api/questions/${templateId}/restore`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);
    const restoredTemplateId = restoreResponse.body.data._id;
    expect(restoredTemplateId).not.toBe(templateId);
    expect(restoredTemplateId).not.toBe(updatedTemplateId);
    expect(restoreResponse.body.data.version).toBe(3);
    expect(restoreResponse.body.data.previousTemplateId).toBe(templateId);
    expect(restoreResponse.body.data.title).toBe('你的年龄');

    const versionListAfterRestore = await request(app)
      .get(`/api/questions/${templateId}/versions`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    expect(versionListAfterRestore.body.data.map((item: { version: number }) => item.version)).toEqual([3, 2, 1]);

    await request(app)
      .delete(`/api/questions/${restoredTemplateId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    await request(app)
      .delete(`/api/questions/${updatedTemplateId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    await request(app)
      .delete(`/api/questions/${templateId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const listResponse = await request(app).get('/api/questions').set('Authorization', `Bearer ${authToken}`).expect(200);
    expect(listResponse.body.data).toHaveLength(0);
  });

  it('supports sharing question template to another user', async () => {
    await request(app).post('/api/auth/register').send({ username: 'owner', password: 'password123' }).expect(201);
    await request(app).post('/api/auth/register').send({ username: 'student', password: 'password123' }).expect(201);

    const ownerLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'owner', password: 'password123' })
      .expect(200);
    const studentLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'student', password: 'password123' })
      .expect(200);

    const ownerToken = ownerLogin.body.data.token;
    const studentToken = studentLogin.body.data.token;

    const createResponse = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(questionTemplatePayload)
      .expect(201);
    const templateId = createResponse.body.data._id;

    const shareResponse = await request(app)
      .put(`/api/questions/${templateId}/shares`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ usernames: ['student'] })
      .expect(200);
    expect(shareResponse.body.data.usernames).toEqual(['student']);

    const studentListResponse = await request(app)
      .get('/api/questions')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(studentListResponse.body.data).toHaveLength(1);
    expect(studentListResponse.body.data[0]._id).toBe(templateId);

    await request(app)
      .put(`/api/questions/${templateId}/shares`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ usernames: [] })
      .expect(403);
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
