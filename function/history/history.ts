import { APIGatewayEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { generateToken, Payload, verifyToken } from 'customJwt';
import { promisePool } from 'customMysql';
import { PrayerHistoryType, Session } from "../dataType";
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
  session: Session, req: { historyRange?: number }
}): Promise<APIGatewayProxyResult> {

  const { historyRange } = req;

  try {
    const query = `
    SELECT 
        prayer_history_id,
        duration,
        note,
        UNIX_TIMESTAMP(created_date) AS created_date
    FROM 
        prayer_history
    WHERE 
        user_id = ?
      ${historyRange !== undefined
        ? 'AND created_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)'
        : ''
      }
    ORDER BY 
        created_date
    `;

    const queryParams = historyRange !== undefined ? [session.user_id, historyRange] : [session.user_id];

    const [rows] = await promisePool.query(query, queryParams) as [PrayerHistoryType[], unknown];

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
  session: Session, req: { lecture_id: string, duration: string, note: string }
}): Promise<APIGatewayProxyResult> {
  try {
    const { user_id } = session;
    const { lecture_id, duration, note } = req;

    if (!lecture_id || !duration || !note) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "bad request" }),
      }
    }

    const prayer_history_id = uuidv4();

    const [rows] = await promisePool.query(`
    INSERT INTO prayer_history
    (prayer_history_id, user_id, lecture_id, duration, note)
    VALUES
    (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    user_id = VALUES(user_id),
    lecture_id = VALUES(lecture_id),
    duration = VALUES(duration),
    note = VALUES(note)
    `, [prayer_history_id, user_id, lecture_id, Number(duration), note]
    ) as [{ affectedRows: number }, unknown];

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
      body: JSON.stringify({ prayer_history_id }),
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
  session, req
}: {
  session: Session, req: { prayer_history_id: string, note: string }
}): Promise<APIGatewayProxyResult> {
  try {
    const { user_id } = session;
    const { prayer_history_id, note } = req;

    if (!prayer_history_id || !note) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "bad request" }),
      }
    }

    const [rows] = await promisePool.query(`
    UPDATE prayer_history
    SET 
      note = ?, 
      updated_date = NOW()
    WHERE prayer_history_id = ?
      AND user_id = ?
    `, [note, prayer_history_id, user_id]
    ) as [{ affectedRows: number }, unknown];

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
  session: Session, req: { prayer_history_id: string }
}): Promise<APIGatewayProxyResult> {
  try {
    const { user_id } = session;
    const { prayer_history_id } = req;

    if (!prayer_history_id) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "bad request" }),
      }
    }

    const [rows] = await promisePool.query(`
    UPDATE prayer_history
    SET 
      note = NULL, 
      updated_date = NOW()
    WHERE prayer_history_id = ?
      AND user_id = ?
    `, [prayer_history_id, user_id]
    ) as [{ affectedRows: number }, unknown];

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

export const historyHandler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
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
