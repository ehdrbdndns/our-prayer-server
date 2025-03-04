import { APIGatewayEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { generateToken, Payload, verifyToken } from 'customJwt';
import { promisePool } from 'customMysql';
import { Session } from "../dataType";
import { v4 as uuidv4 } from 'uuid';
import { ResultSetHeader } from "mysql2";
import { GetQueueUrlCommand, SendMessageCommand } from "@aws-sdk/client-sqs";
import { NOTIFICATION_QUEUE_URL } from "./keys";
import { SQS_CLIENT } from "./handler";

async function getQueueUrl(queueName: string): Promise<string> {
  const getQueueUrlCommand = new GetQueueUrlCommand({
    QueueName: queueName
  });

  const getQueueUrlResponse = await SQS_CLIENT.send(getQueueUrlCommand);
  return getQueueUrlResponse.QueueUrl || '';
}

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
  session: Session, req: { question_id?: string }
}) {

  const { user_id } = session;
  const { question_id } = req;

  try {

    const [rows]: any = await promisePool.query(`
    SELECT
      question.question_id AS question_id
      , question.content AS content
      , COUNT(question_reply.question_reply_id) AS reply_count
      , UNIX_TIMESTAMP(question.created_date) AS created_date
    FROM question

      LEFT JOIN question_reply
        ON question.question_id = question_reply.question_id
          AND question_reply.is_active = 1

    WHERE
    ${question_id ? 'question.question_id = ? AND' : ""}
      question.user_id = ?
      AND question.is_active = 1
    GROUP BY question.question_id
    ORDER BY question.created_date DESC
    `, question_id ? [question_id, user_id] : [user_id]);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(question_id ? rows[0] : rows),
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
  }
}

async function handlePost({
  session,
  req
}: {
  session: Session
  req: { content: string }
}) {

  const { user_id } = session;
  const { content } = req;

  if (!content) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ message: "content is required" }),
    };
  }

  try {
    const question_id = uuidv4();

    const [rows] = await promisePool.query(`
    INSERT INTO question
      (question_id, user_id, content, is_answered, is_active)
    VALUES
      (?, ?, ?, 0, 1)
    `, [question_id, user_id, content]) as [ResultSetHeader, unknown];;

    if (rows.affectedRows === 0) {
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "internal server error" }),
      };
    }

    // Send notification to admin
    try {
      const queueUrl = NOTIFICATION_QUEUE_URL;
      const messageBody = JSON.stringify({ user_id })

      if (!queueUrl) {
        throw new Error('Failed to get queue url');
      }

      const sendMessageCommand = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageAttributes: {
          Type: {
            DataType: "String",
            StringValue: "question"
          },
          Method: {
            DataType: "String",
            StringValue: "insert"
          }
        },
        MessageBody: messageBody
      })

      await SQS_CLIENT.send(sendMessageCommand);
    } catch (e) {
      console.error(e);
      console.error('Failed to send message to SQS of notification');
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ message: "success" }),
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
  }
}

async function handlePut({
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
      body: JSON.stringify({ message: "content is required" }),
    };
  }

  try {

    const [rows] = await promisePool.query(`
    UPDATE question
    SET content = ?, updated_date = NOW()
    WHERE question_id = ?
      AND user_id = ?
    `, [content, question_id, user_id]) as [ResultSetHeader, unknown];;

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
  }
}

async function handleDelete({
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
      body: JSON.stringify({ message: "question_id is required" }),
    };
  }

  try {
    const [rows] = await promisePool.query(`
    UPDATE question
    SET is_active = 0, updated_date = NOW()
    WHERE question_id = ?
      AND user_id = ?
    `, [question_id, user_id]) as [ResultSetHeader, unknown];

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

export const questionHandler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
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
      case "put":
        response = await handlePut({ session, req });
        break;
      case "delete":
        response = await handleDelete({ session, req });
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
