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

  const { user_id } = session;

  try {
    const [plans]: any = await promisePool.query(`
      SELECT
        plan.plan_id, title, description, 
        author_name, author_description, author_profile,
        thumbnail, s_thumbnail,
        IFNULL(plan_like.user_id, 0) AS is_liked,
        IFNULL(plan_like.plan_like_id, 0) AS plan_like_id,
        UNIX_TIMESTAMP(plan_lecture_audit.updated_date) AS audit_updated_date
      FROM plan

        LEFT JOIN plan_like 
          ON plan.plan_id = plan_like.plan_id
            AND plan_like.user_id = ?

        INNER JOIN plan_lecture_audit
          ON plan.plan_id = plan_lecture_audit.plan_id

      WHERE is_active = 1
    `, [user_id]);

    const [currentPlan]: any = await promisePool.query(`
      SELECT lecture.plan_id
      FROM prayer_history

        INNER JOIN lecture ON prayer_history.lecture_id = lecture.lecture_id

      WHERE prayer_history.user_id = ?
      ORDER BY prayer_history.created_date DESC
      LIMIT 1
    `, [user_id]);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        plans,
        currentPlan: currentPlan.length > 0 ? currentPlan[0] : null
      }),
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

export const planHandler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
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
        response = await handleGet({ session });
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
