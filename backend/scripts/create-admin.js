/* Usage: npm run create-admin -- "Admin Name" admin@example.com 'strong-password' */
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db/pool');

async function main() {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password || password.length < 8) {
    console.error('Usage: npm run create-admin -- "Name" email password(min 8 chars)');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, lower($2), $3, 'admin')
     ON CONFLICT ((lower(email))) DO UPDATE SET role = 'admin', password_hash = EXCLUDED.password_hash
     RETURNING id, email`,
    [name, email, hash],
  );
  console.log(`admin ready: #${rows[0].id} ${rows[0].email}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
