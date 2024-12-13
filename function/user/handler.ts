import { Context, APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler as auth } from './auth/index'

const router: { [key: string]: (event: APIGatewayEvent, context: Context) => Promise<APIGatewayProxyResult> } = {
  "/user/auth": auth,
}

export const handler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
  let path: string = '';

  if (event.path) {
    path = event.path.split('/').slice(0, 3).join('/');
  }

  let res: APIGatewayProxyResult = {
    statusCode: 500, body: 'internal server error'
  };

  if (path in router) {
    res = await router[path](event, context);
  }

  return res;
}