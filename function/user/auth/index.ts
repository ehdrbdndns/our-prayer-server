import { APIGatewayEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { promisePool } from "customMysql"
import jwt, { generateToken } from 'customJwt';

const createUser = () => {

}

export const handler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
  try {
    const req = event.queryStringParameters || JSON.parse(event.body || "");
    const HttpMethod = event.requestContext.httpMethod;

    let ret: any = {};
    switch (HttpMethod.toLowerCase()) {
      case "get":
        break;
      case "post":
        break;
      case "patch":
        break;
      case "put":
        break;
      case "delete":
        break;
      default:
        ret = { data: { message: "method not allowed" }, code: 405 };
        break;
    }

    const response = {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(ret)
    };

    return response;

  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ data: { message: "internal server error" }, code: 500 }),
    };

  }
}
