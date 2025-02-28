import { Context, APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';
import { questionHandler } from './question';
import { replyHandler } from './reply';

const router: { [key: string]: (event: APIGatewayEvent, context: Context) => Promise<APIGatewayProxyResult> } = {
  "/question": questionHandler,
  "/question/reply": replyHandler
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