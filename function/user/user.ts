import { APIGatewayEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { generateToken, Payload, verifyToken } from 'customJwt';
import { promisePool } from 'customMysql';
import { Session } from "../dataType";

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
  session
}: {
  session: Session
}): Promise<APIGatewayProxyResult> {
  try {
    const { user_id } = session;

    // retrieve user and user_state
    const [rows]: any = await promisePool.query(`
      SELECT 
        name, alarm, expo_push_token
        , UNIX_TIMESTAMP(user.created_date) as created_date
      FROM user

        INNER JOIN user_state
          ON user.user_id = user_state.user_id

      WHERE user.user_id = ?
      
      LIMIT 1
    `, [user_id]);

    if (rows.length === 0) {
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "internal server error" }),
      };
    }

    const user = rows[0];

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(user),
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

async function handlePut({
  session, req
}: {
  session: Session, req: { name?: string, alarm?: boolean, expoPushToken?: string }
}): Promise<APIGatewayProxyResult> {
  try {
    const { name, alarm, expoPushToken } = req;
    const { user_id } = session;

    if (name === undefined && alarm === undefined && expoPushToken === undefined) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "bad request" }),
      }
    }

    if (name !== undefined) {
      const [rows] = await promisePool.query(`
      UPDATE user
      SET name = ?, updated_date = NOW()
      WHERE user_id = ?
      `, [name, user_id]) as [{ affectedRows: number }, unknown];

      if (rows.affectedRows === 0) {
        return {
          statusCode: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ message: "internal server error" }),
        };
      }
    }

    if (alarm !== undefined) {
      const [rows] = await promisePool.query(`
        UPDATE user_state
        SET alarm = ?, updated_date = NOW()
        WHERE user_id = ?
      `, [alarm, user_id]) as [{ affectedRows: number }, unknown];

      if (rows.affectedRows === 0) {
        return {
          statusCode: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ message: "internal server error" }),
        };
      }
    }

    if (expoPushToken !== undefined) {
      const [rows] = await promisePool.query(`
        UPDATE user_state
        SET expo_push_token = ?, updated_date = NOW()
        WHERE user_id = ?
      `, [expoPushToken, user_id]) as [{ affectedRows: number }, unknown];

      if (rows.affectedRows === 0) {
        return {
          statusCode: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ message: "internal server error" }),
        };
      }
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

async function handleDelete({
  session
}: {
  session: Session
}): Promise<APIGatewayProxyResult> {
  const conn = await promisePool.getConnection();

  try {
    const { user_id } = session;
    await conn.beginTransaction();

    // update user_state
    const [userStateRows] = await conn.query(`
    UPDATE user_state
    SET status = 'inactive', updated_date = NOW()
    WHERE user_id = ?
    `, [user_id]) as [{ affectedRows: number }, unknown];

    if (userStateRows.affectedRows === 0) {
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "internal server error" }),
      };
    }

    // expire refresh_token
    const [refreshTokenRows] = await conn.query(`
    UPDATE refresh_token
    SET expires_date = NOW()
    WHERE user_id = ?
    `, [user_id]) as [{ affectedRows: number }, unknown];

    if (refreshTokenRows.affectedRows === 0) {
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "internal server error" }),
      };
    }

    await conn.commit();

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ message: "success" }),
    }
  } catch (e) {
    console.error(e);
    await conn.rollback();
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

export const userHandler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
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
        response = await handleGet({ session });
        break;
      case "put":
        response = await handlePut({ session, req });
        break;
      case "delete":
        response = await handleDelete({ session });
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
