import { v4 as uuidv4 } from 'uuid';
import { promisePool } from "customMysql";
import { generateToken } from "customJwt";
import { ResultSetHeader } from "mysql2";

const adjectives = [
  "용감한", "차분한", "기쁜", "행복한", "사랑스러운"
  , "친절한", "지혜로운", "강한", "부지런한", "명랑한"
  , "조용한", "밝은", "희망찬", "믿음직한", "성실한", "온유한"
  , "겸손한", "충성스러운", "신실한", "감사한"
];

const firstNames = [
  "요한", "바울", "베드로", "야고보", "안드레", "빌립"
  , "도마", "마태", "나다니엘", "시몬", "다대오", "유다"
  , "마리아", "마르다", "엘리사벳", "안나", "룻", "에스더"
  , "드보라", "사라", "다니엘"
];

function generateRandomChristianName(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  return `${adjective} ${firstName}`;
}

export const register = async (ret: {
  alarm: boolean,
  expoPushToken: string,
  userType: 'local' | 'sns'
}): Promise<{
  statusCode?: number,
  data: {
    message: string
  }
} | {
  statusCode?: number,
  data: {
    accessToken: string,
    refreshToken: string,
    name: string
  }
}> => {

  const { alarm, expoPushToken, userType } = ret;

  if (
    !userType && userType !== 'local' && userType !== 'sns'
    || alarm === undefined || !expoPushToken
  ) {
    return {
      statusCode: 400,
      data: {
        message: "bad request"
      }
    }
  }

  if (userType === 'local') {
    const conn = await promisePool.getConnection();

    const user_id = uuidv4();
    const user_state_id = uuidv4();
    const refresh_token = uuidv4();

    const name = generateRandomChristianName();
    const accessToken = generateToken({ user_id: user_id });

    try {
      await conn.beginTransaction();

      // insert user
      const [insertUserResult] = await conn.query(`
      INSERT INTO user
        (user_id, name)
      VALUES
        (?, ?)
      `, [user_id, name]
      ) as [ResultSetHeader, unknown];

      if (insertUserResult.affectedRows === 0) {
        throw new Error("user insert error");
      }

      // insert user_state
      const [insertStateResult] = await conn.query(`
      INSERT INTO user_state
        (user_state_id, user_id, role, status, alarm, expo_push_token)
      VALUES
        (?, ?, ?, ?, ?, ?)
      `, [user_state_id, user_id, 'user', 'active', alarm, expoPushToken]
      ) as [ResultSetHeader, unknown];

      if (insertStateResult.affectedRows === 0) {
        throw new Error("user state insert error");
      }

      // insert refresh token
      const [insertRefreshTokenResult] = await conn.query(`
      INSERT INTO refresh_token
        (refresh_token, user_id, expires_date)
      VALUES
        (?, ?, ?)  
      `, [refresh_token, user_id, '9999-01-01']
      ) as [ResultSetHeader, unknown];

      if (insertRefreshTokenResult.affectedRows === 0) {
        throw new Error("refresh token insert error");
      }

      await conn.commit();

      return {
        statusCode: 200,
        data: {
          name,
          accessToken: accessToken,
          refreshToken: refresh_token,
        }
      }
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  // Todo: sns user register
}