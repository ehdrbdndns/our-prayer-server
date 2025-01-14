import { APIGatewayEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { generateToken, Payload, verifyToken } from 'customJwt';
import { promisePool } from 'customMysql';
import { LectureAudioType, Session } from "../dataType";

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
  session: Session, req: { plan_id: number }
}): Promise<APIGatewayProxyResult> {

  const { plan_id } = req;

  if (!plan_id) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ message: "bad request" }),
    }
  }

  try {
    const [rows] = await promisePool.query(`
      SELECT 
        l.lecture_id, 
        l.bgm,
        la.lecture_audio_id, 
        la.audio,
        la.caption,
        la.start_time
      FROM lecture l

        LEFT JOIN lecture_audio la 
          ON l.lecture_id = la.lecture_id
            AND la.is_active = 1

      WHERE l.plan_id = ?
        AND l.is_active = 1
    `, [plan_id]) as [(LectureAudioType & { bgm: string })[], unknown];

    if (rows.length === 0) {
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "not found" }),
      };
    }

    const lectureAudioList: {
      [lecture_id: string]: {
        audios: {
          lecture_audio_id: string,
          uri: string,
          caption: string,
          start_time: number
        }[],
        bgm: string
      }
    } = {};

    for (const row of rows) {
      if (!lectureAudioList[row.lecture_id]) {
        lectureAudioList[row.lecture_id] = {
          audios: [],
          bgm: row.bgm
        };
      }

      if (row.lecture_audio_id) {
        lectureAudioList[row.lecture_id].audios.push({
          lecture_audio_id: row.lecture_audio_id,
          uri: row.audio,
          caption: row.caption,
          start_time: row.start_time
        });
      }
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(lectureAudioList),
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

export const lectureAudioHandler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
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
