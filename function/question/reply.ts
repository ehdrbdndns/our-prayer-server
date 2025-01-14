import { APIGatewayEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { generateToken, Payload, verifyToken } from 'customJwt';
import { promisePool } from 'customMysql';
import { Session } from "../dataType";
import { v4 as uuidv4 } from 'uuid';
import { ResultSetHeader } from "mysql2";

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
  session: Session, req: { question_id: string }
}) {
  const { user_id } = session;
  const { question_id } = req;

  if (!question_id) {
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
      question_reply_id, question_reply.user_id
      , question_reply.question_id, question_reply.content
      , UNIX_TIMESTAMP(question_reply.updated_date) AS updated_date
      , UNIX_TIMESTAMP(question_reply.created_date) AS created_date
    FROM question_reply

      INNER JOIN question
        ON question_reply.question_id = question.question_id
          AND question.is_active = 1
          AND question.user_id = ?

    WHERE question_reply.question_id = ?
      AND question_reply.is_active = 1
    ORDER BY question_reply.created_date
    `, [user_id, question_id]);

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
    }
  }
}

async function handlePost({
  session,
  req
}: {
  session: Session
  req: { question_id: string, content: string }
}) {

  const { user_id } = session;
  const { question_id, content } = req;

  if (!question_id || !content) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ message: "bad request" }),
    }
  }

  const conn = await promisePool.getConnection();
  try {
    conn.beginTransaction();
    const question_reply_id = uuidv4();

    const [insertedReply] = await conn.query(`
    INSERT INTO question_reply
      (question_reply_id, question_id, user_id, content, is_active, is_replier)
    VALUES
      (?, ?, ?, ?, 1, 0)
    `, [question_reply_id, question_id, user_id, content]) as [ResultSetHeader, unknown];

    if (insertedReply.affectedRows === 0) {
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "internal server error" }),
      };
    }

    const [updatedQuestion] = await conn.query(`
    UPDATE question
    SET is_answered = 0, updated_date = NOW()
    WHERE question_id = ?
    `, [question_id]) as [ResultSetHeader, unknown];;

    if (updatedQuestion.affectedRows === 0) {
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "internal server error" }),
      }
    }

    await conn.commit();

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ question_reply_id }),
    };
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ message: "internal server error" }),
    };
  } finally {
    conn.release();
  }
}

export const replyHandler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
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
