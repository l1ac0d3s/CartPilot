const bcrypt = require('bcryptjs');
const db = require('../db/pool');
const { signToken } = require('../middleware/auth');
const { conflict, unauthorized, notFound } = require('../utils/errors');

const BCRYPT_ROUNDS = 10;

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, role: row.role, createdAt: row.created_at };
}

async function register({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    const { rows } = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, lower($2), $3) RETURNING *',
      [name.trim(), email.trim(), passwordHash],
    );
    const user = publicUser(rows[0]);
    return { user, token: signToken(user) };
  } catch (err) {
    if (err.code === '23505') throw conflict('An account with this email already exists', { code: 'EMAIL_TAKEN' });
    throw err;
  }
}

async function login({ email, password }) {
  const { rows } = await db.query('SELECT * FROM users WHERE lower(email) = lower($1)', [email.trim()]);
  const row = rows[0];
  // Compare against a dummy hash when the user is missing to keep timing uniform.
  const hash = row?.password_hash || '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.6L2bK8C6VZ8XyN2rJ8zPj0fFQ5aG';
  const ok = await bcrypt.compare(password, hash);
  if (!row || !ok) throw unauthorized('Invalid email or password', { code: 'INVALID_CREDENTIALS' });
  const user = publicUser(row);
  return { user, token: signToken(user) };
}

async function getUser(id) {
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  if (!rows.length) throw notFound('User not found');
  return publicUser(rows[0]);
}

module.exports = { register, login, getUser, publicUser };
