import { APIGatewayEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { generateToken, Payload, verifyToken } from 'customJwt';
import { promisePool } from 'customMysql';
import { LectureAudioType, LectureType, Session } from "../dataType";

const generateTokenByRefreshToken = async (refreshToken: string) => {
  try {
    const [rows]: any = await promisePool.query(`
    SELECT user_id
    FROM refresh_token
    WHERE refresh_token = ? 
      AND expires_date > NOW()
    LIMIT 1
    `, [refreshToken]);

    if (rows.length === 0) {
      return "";
    }

    const user_id = rows[0].user_id;

    const payload = generateToken({ user_id });

    return payload;
  } catch (e) {
    console.error(e);
    throw new Error('Error refreshing token');
  }
}

async function handleGet({
  session, req
}: {
  session: Session, req: { lecture_id: number }
}): Promise<APIGatewayProxyResult> {
  try {

    const { user_id } = session;
    const { lecture_id } = req;

    if (!lecture_id) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "bad request" }),
      }
    }

    const [lecture] = await promisePool.query(`
    SELECT
      lecture_id, plan_id, time, title
      , lecture_user_audio.audio AS bgm
    FROM lecture

      INNER JOIN lecture_user_audio
        ON lecture.lecture_id = lecture_user_audio.lecture_audio_id
          AND user_id = ?

    WHERE lecture_id = ?
      AND is_active = 1
    LIMIT 1
    `, [user_id, lecture_id]) as [LectureType[], unknown];

    if (lecture.length === 0) {
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "not found" }),
      }
    }

    const [lectureAudios] = await promisePool.query(`
    SELECT
      caption, start_time
      , lecture_user_audio.audio AS audio
      , lecture_audio.lecture_audio_id
    FROM lecture_audio

      INNER JOIN lecture_user_audio
        ON lecture_audio.lecture_audio_id = lecture_user_audio.lecture_audio_id
          AND user_id = ?

    WHERE lecture_id = ?
      AND is_active = 1
    `, [user_id, lecture_id]) as [LectureAudioType[], unknown];

    const res = {
      lecture: lecture[0],
      lectureAudios
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(res),
    }
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ message: "internal server error" }),
    };
  }
}

async function handlePost({
  session, req
}: {
  session: Session, req: { lecture_id: number }
}): Promise<APIGatewayProxyResult> {
  try {

    const { lecture_id } = req;

    if (!lecture_id) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "bad request" }),
      }
    }

    const [lecture] = await promisePool.query(`
    SELECT
      lecture_id, plan_id, time, title
    FROM lecture

    WHERE lecture_id = ?
      AND is_active = 1
    LIMIT 1
    `, [lecture_id]) as [LectureType[], unknown];

    if (lecture.length === 0) {
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "not found" }),
      }
    }

    const [lectureAudios] = await promisePool.query(`
    SELECT
      caption, start_time, lecture_audio_id
    FROM lecture_audio

    WHERE lecture_id = ?
      AND is_active = 1
    `, [lecture_id]) as [LectureAudioType[], unknown];

    const res = {
      lecture: lecture[0],
      lectureAudios
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(res),
    }
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ message: "internal server error" }),
    };
  }
}

export const lectureHandler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
  try {
    const req = event.queryStringParameters || JSON.parse(event.body || "{}");
    const HttpMethod = event.requestContext.httpMethod;

    const getHeader = (headerName: string): string => {
      return event.headers?.[headerName] || event.headers?.[headerName.toLowerCase()] || '';
    };

    const jwtToken = getHeader('Authorization').replace('Bearer ', '');
    const refreshToken = getHeader('Refreshtoken');
    let decodedToken: Payload = {};

    if (jwtToken) {
      decodedToken = verifyToken(jwtToken);
    }

    if (!decodedToken.user_id) {
      const newAccessToken = await generateTokenByRefreshToken(refreshToken);

      return {
        statusCode: 401,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          expiredType: newAccessToken !== "" ? "access" : "wrong",
          accessToken: newAccessToken !== "" ? newAccessToken : "",
          refreshToken
        }),
      };
    }

    const session: Session = { user_id: decodedToken.user_id };
    let response: any = {};

    switch (HttpMethod.toLowerCase()) {
      case "get":
        response = await handleGet({ session, req });
        break;
      case "post":
        response = await handlePost({ session, req });
        break;
      default:
        response = {
          statusCode: 405,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ message: "Method Not Allowed" }),
        };
        break;
    }

    return response;

  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ message: "internal server error" }),
    };

  }
}
