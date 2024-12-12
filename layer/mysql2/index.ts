import { createPool } from 'mysql2';
import { DB_DATABASE, DB_HOST, DB_PASSWORD, DB_USER } from './keys';

// MySQL 연결 풀 생성
export const pool = createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_DATABASE,
  port: 3306,
  connectionLimit: 10,
  waitForConnections: true,
});

export const promisePool = pool.promise();

// 연결 풀을 export
export default promisePool;