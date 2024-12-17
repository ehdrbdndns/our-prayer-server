import { APIGatewayEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { Payload, verifyToken } from 'customJwt';
import { promisePool } from 'customMysql';

async function handleGet(): Promise<APIGatewayProxyResult> {
  try {
    const [rows] = await promisePool.query(`
    SELECT title, content
    FROM bible_quote 
    ORDER BY RAND()
    LIMIT 1
    `);

    return {
      statusCode: 200,
      body: JSON.stringify(rows[0]),
    };
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "internal server error" }),
    };
  }
}

export const bibleHandler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
  try {
    const req = event.queryStringParameters || JSON.parse(event.body || "");
    const HttpMethod = event.requestContext.httpMethod;

    const jwtToken = (event.headers && (event.headers.Authorization || event.headers.authorization) || '').replace('Bearer ', '');
    let sessionInfo: Payload = {};

    if (jwtToken) {
      sessionInfo = verifyToken(jwtToken);
    }

    if (!sessionInfo.user_id) {
      return {
        statusCode: 401,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "Unauthorized" }),
      };
    }

    let response: any = {};

    switch (HttpMethod.toLowerCase()) {
      case "get":
        response = await handleGet();
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
