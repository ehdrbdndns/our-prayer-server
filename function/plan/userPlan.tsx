import { APIGatewayEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { generateToken, Payload, verifyToken } from 'customJwt';
import { promisePool } from 'customMysql';
import { PlanType, Session } from "../dataType";
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

async function handleGet({ session }: {
  session: Session, req: { historyRange?: number }
}): Promise<APIGatewayProxyResult> {
  try {

    const user_id = session.user_id;

    const [rows] = await promisePool.query(`
    SELECT 
      plan_like.plan_id, title, description
      , thumbnail, s_thumbnail
      , author_name, author_description, author_profile
    FROM plan_like

      INNER JOIN plan
        ON plan_like.plan_id = plan.plan_id
          AND plan.is_active = 1
    
    WHERE user_id = ?
    `, [user_id]) as [PlanType[], unknown];

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

async function handlePost({ session, req }: {
  session: Session, req: { plan_id: string }
}): Promise<APIGatewayProxyResult> {
  try {
    const plan_id = req.plan_id;
    const plan_like_id = uuidv4();
    const user_id = session.user_id;

    if (!plan_id) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "bad request" }),
      }
    }

    const [rows] = await promisePool.query(`
    INSERT INTO plan_like
    (plan_like_id, plan_id, user_id)
    VALUES (?, ?, ?)
    `, [plan_like_id, plan_id, user_id]) as [{ affectedRows: number }, unknown];

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
      body: JSON.stringify({ message: "success", plan_like_id }),
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

async function handleDelete({ session, req }: {
  session: Session, req: { plan_like_id: string }
}): Promise<APIGatewayProxyResult> {
  try {
    const plan_like_id = req.plan_like_id;
    const user_id = session.user_id;

    if (!plan_like_id) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "bad request" }),
      }
    }

    const [rows] = await promisePool.query(`
    DELETE FROM plan_like
    WHERE plan_like_id = ?
      AND user_id = ?
    `, [plan_like_id, user_id]) as [{ affectedRows: number }, unknown];

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
      body: JSON.stringify({ message: "success", plan_like_id }),
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

export const userPlanHandler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
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
