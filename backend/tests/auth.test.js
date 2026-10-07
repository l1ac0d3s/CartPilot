const { app, request, db, resetDb, createUser } = require('./helpers');

beforeEach(resetDb);
afterAll(() => db.pool.end());

describe('auth', () => {
  test('register returns a token and lowercases the email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Asha', email: 'Asha@Example.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toMatchObject({ name: 'Asha', email: 'asha@example.com', role: 'customer' });
  });

  test('duplicate email is a 409 regardless of case', async () => {
    await createUser({ email: 'dup@test.dev' });
    const res = await request(app).post('/api/auth/register').send({ name: 'X Y', email: 'DUP@test.dev', password: 'password123' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  test('validation errors are reported per field', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual(['email', 'name', 'password']);
  });

  test('login succeeds with the right password and fails otherwise', async () => {
    await createUser({ email: 'login@test.dev', password: 'correct-horse' });
    const ok = await request(app).post('/api/auth/login').send({ email: 'LOGIN@test.dev', password: 'correct-horse' });
    expect(ok.status).toBe(200);
    const bad = await request(app).post('/api/auth/login').send({ email: 'login@test.dev', password: 'wrong-pass' });
    expect(bad.status).toBe(401);
    const missing = await request(app).post('/api/auth/login').send({ email: 'ghost@test.dev', password: 'whatever' });
    expect(missing.status).toBe(401);
  });

  test('/me requires a valid token', async () => {
    const user = await createUser();
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer junk')).status).toBe(401);
    const me = await request(app).get('/api/auth/me').set('Authorization', user.auth);
    expect(me.body.user.id).toBe(user.user.id);
  });
});
