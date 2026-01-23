import { APIGatewayEvent, APIGatewayProxyResult, Context } from "aws-lambda";

import { promisePool } from 'customMysql';
import { AppInfoType } from "../dataType";

async function handleGet(): Promise<APIGatewayProxyResult> {

  try {

    const [rows] = await promisePool.query(`
    SELECT * 
    FROM app_notice
    WHERE is_active = 1
    ORDER BY priority ASC, created_date DESC
    `, []) as [AppInfoType[], unknown];

    console.log(rows)

    if (rows.length === 0) {
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "not found" }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        ...rows[0]
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

export const appNoticeHandler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
  try {
    const HttpMethod = event.requestContext.httpMethod;

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
