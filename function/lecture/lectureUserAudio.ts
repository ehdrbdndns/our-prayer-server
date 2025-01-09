import { APIGatewayEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { generateToken, Payload, verifyToken } from 'customJwt';
import { promisePool } from 'customMysql';
import { Session } from "../dataType";
import { v4 as uuidv4 } from 'uuid';

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

  try {
    const [rows]: any = await promisePool.query(`
    SELECT 
      lecture_user_audio.audio AS audio,
      lecture_audio.caption AS caption,
      lecture_audio.start_time AS start_time

    FROM lecture_user_audio
    
      INNER JOIN lecture_audio
        ON lecture_user_audio.lecture_audio_id = lecture_audio.lecture_audio_id
          AND lecture_audio.lecture_id = ?
          AND lecture_audio.is_active = 1
    
    WHERE lecture_user_audio.user_id = ?
    `, [lecture_id, user_id]);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(rows),
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
  session: Session, req: { lecture_audio_id: string, audio: string }[]
}): Promise<APIGatewayProxyResult> {

  const { user_id } = session;

  if (!req || req.length === 0) {
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
    INSERT INTO lecture_user_audio
      (lecture_user_audio_id, user_id, lecture_audio_id, audio)
    VALUES
      ?
    ON DUPLICATE KEY UPDATE
      audio = VALUES(audio)
    `, [req.map(({ lecture_audio_id, audio }) => {
      return [uuidv4(), user_id, lecture_audio_id, audio];
    })]) as [{ affectedRows: number }, unknown];

    if (rows.affectedRows === 0) {
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "internal server error" }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ message: "success" }),
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

export const lectureUserAudioHandler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
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
      const userId = await generateTokenByRefreshToken(refreshToken);
      const newAccessToken = userId !== "" ? generateToken({ user_id: userId }) : "";

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
