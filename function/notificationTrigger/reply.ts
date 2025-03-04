import { promisePool } from 'customMysql';
import { SQSMethod } from '../dataType';
import { pushNotification } from './pushServer';

const handleInsert = async (body: string) => {
  if (!body) {
    console.error('bad request: body is invalid', body);
    return;
  }

  try {
    const { user_id } = JSON.parse(body);

    if (!user_id) {
      console.error('bad request: user_id is invalid', user_id);
      return;
    }

    // get user name
    const [users] = await promisePool.query(`
    SELECT name
    FROM user
    WHERE user_id = ?
    `, [user_id]) as any;

    if (users.length === 0) {
      console.error('internal server error: user_id is invalid', user_id);
      return;
    }

    // get admin device token
    const [admins] = await promisePool.query(`
    SELECT expo_push_token
    FROM user_state
    WHERE role = 'admin'
    `, []) as [{ expo_push_token: string }[], any];

    if (admins.length === 0) {
      console.error('internal server error: admin is not found');
      return;
    }

    // send notification for admin by device token
    await pushNotification({
      pushTokens: admins.map((user: { expo_push_token: string }) => user.expo_push_token),
      body: `${users[0].name}님이 답변을 등록했습니다.`,
      title: '질문 답변 알림',
      subtitle: '',
      data: {},
      sound: 'default',
      badge: 0,
    })

  } catch (e) {
    console.error(e);
    console.error("invalid server error")
  }
}

export const replyHandler = async ({ method, body }: {
  method: SQSMethod;
  body: string;
}) => {
  // check method
  switch (method) {
    case 'insert':
      await handleInsert(body);
      break;
    default:
      console.error('Invalid method', method);
      break;
  }
}