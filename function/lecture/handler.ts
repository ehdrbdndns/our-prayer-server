import { Context, APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';
import { lectureHandler } from './lecture';
import { lectureAudioHandler } from './lectureAudio';
import { lectureUserAudioHandler } from './lectureUserAudio';

const router: { [key: string]: (event: APIGatewayEvent, context: Context) => Promise<APIGatewayProxyResult> } = {
  "/lecture": lectureHandler,
  "/lecture/audio": lectureAudioHandler,
  "/lecture/userAudio": lectureUserAudioHandler,
}

export const handler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
  let path: string = '';

  if (event.path) {
    path = event.path.split('/').slice(0, 3).join('/');
  }

  let res: APIGatewayProxyResult = {
    statusCode: 500,
    body: JSON.stringify({ message: "internal server error" }),
  };

  if (path in router) {
    res = await router[path](event, context);
  }

  return res;
}