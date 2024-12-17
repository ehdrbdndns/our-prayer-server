import { APIGatewayEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { Payload, verifyToken } from 'customJwt';
import { register } from "./register";

// HTTP 메서드 처리 함수 정의
async function handlePost(req: any): Promise<APIGatewayProxyResult> {
  const ret = await register(req);
  return {
    statusCode: ret.statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(ret.data),
  };
}

async function handlePut(req: any): Promise<APIGatewayProxyResult> {
  // re-generate token by refresh token
  return {
    statusCode: 501,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({ message: "Not Implemented" }),
  };
}

async function handleDelete(req: any): Promise<APIGatewayProxyResult> {
  // delete user
  return {
    statusCode: 501,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({ message: "Not Implemented" }),
  };
}

export const authHandler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
  try {
    const req = event.queryStringParameters || JSON.parse(event.body || "");
    const HttpMethod = event.requestContext.httpMethod;

    const jwtToken = (event.headers && (event.headers.Authorization || event.headers.authorization) || '').replace('Bearer ', '');
    let sessionInfo: Payload = {};

    if (jwtToken) {
      sessionInfo = verifyToken(jwtToken);
    }

    let response: any = {};

    switch (HttpMethod.toLowerCase()) {
      case "post":
        response = await handlePost(req);
        break;
      case "put":
        response = await handlePut(req);
        break;
      case "delete":
        response = await handleDelete(req);
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
