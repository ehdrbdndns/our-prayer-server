import jwt from 'jsonwebtoken';
import { JWT_SECRET_KEY } from './keys';

const TOKEN_EXPIRES_IN = '90d';

export const generateToken = (payload: { [key: string]: string | number }) => {

  const token = jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: TOKEN_EXPIRES_IN });

  return token;
};

export default jwt;