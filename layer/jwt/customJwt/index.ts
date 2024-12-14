import * as jwt from 'jsonwebtoken';
import { JWT_SECRET_KEY } from './keys';

const TOKEN_EXPIRES_IN = '90d';

export interface Payload {
  user_id?: string;
}

export const generateToken = (payload: Payload) => {
  const token = jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: TOKEN_EXPIRES_IN });

  return token;
};

export const verifyToken = (token: string): Payload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET_KEY) as Payload;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return {};
  }
};

export default jwt;