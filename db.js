import mysql from 'mysql2/promise';
import { config } from './config.js';

export const pool = mysql.createPool({
  host: config.db.host,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  port: config.db.port,
  connectionLimit: 10,
  timezone: 'Z'
});

export async function getAccountByEmail(email) {
  const { table, emailCol } = config.schema;
  const [rows] = await pool.query(
    `SELECT * FROM \`${table}\` WHERE \`${emailCol}\` = ? LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

export async function getAccountByLogin(login) {
  const { table, idCol } = config.schema;
  const [rows] = await pool.query(
    `SELECT * FROM \`${table}\` WHERE \`${idCol}\` = ? LIMIT 1`,
    [login]
  );
  return rows[0] || null;
}

export async function addRedbucksToLogin(login, amount) {
  const { table, redbucksCol, idCol } = config.schema;
  const [res] = await pool.query(
    `UPDATE \`${table}\` SET \`${redbucksCol}\` = \`${redbucksCol}\` + ? WHERE \`${idCol}\` = ?`,
    [amount, login]
  );
  return res.affectedRows > 0;
}

export async function updateAccountProfile(login, { email, passwordHash, avatarUrl }) {
  const { table, idCol, emailCol, passwordCol, avatarCol } = config.schema;
  const sets = [];
  const vals = [];
  if (email != null)        { sets.push(`\`${emailCol}\` = ?`);    vals.push(email); }
  if (passwordHash != null) { sets.push(`\`${passwordCol}\` = ?`); vals.push(passwordHash); }
  if (avatarUrl != null)    { sets.push(`\`${avatarCol}\` = ?`);   vals.push(avatarUrl); }
  if (!sets.length) return { affectedRows: 0 };
  vals.push(login);
  const [res] = await pool.query(
    `UPDATE \`${table}\` SET ${sets.join(', ')} WHERE \`${idCol}\` = ?`,
    vals
  );
  return res;
}

export async function getCharacterByUUID(uuid) {
  const { charactersTable, charUuidCol } = config.schema;
  const [rows] = await pool.query(
    `SELECT * FROM \`${charactersTable}\` WHERE \`${charUuidCol}\` = ? LIMIT 1`,
    [uuid]
  );
  return rows[0] || null;
}

export async function getCustomizationByUUID(uuid) {
  const { customizationTable, customUuidCol } = config.schema;
  const [rows] = await pool.query(
    `SELECT * FROM \`${customizationTable}\` WHERE \`${customUuidCol}\` = ? LIMIT 1`,
    [uuid]
  );
  return rows[0] || null;
}
