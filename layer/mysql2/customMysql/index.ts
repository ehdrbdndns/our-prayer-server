import { createPool } from 'mysql2';
import { DB_DATABASE, DB_HOST, DB_PASSWORD, DB_USER } from './keys';

export function getFullDateFromDate(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export function getFullTimeFromDate(date: Date) {
  return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`
}

export function getFullDateTimeFromDate(date: Date) {
  return `${getFullDateFromDate(date)} ${getFullTimeFromDate(date)}`
}

export function createUniqId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function XSSFilter(content: string) {
  return content.replace(/</g, "<").replace(/>/g, ">");
}

// MySQL 연결 풀 생성
export const pool = createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_DATABASE,
  port: 4306,
  connectionLimit: 10,
  waitForConnections: true,
});

export const promisePool = pool.promise();

// 연결 풀을 export
export default promisePool;