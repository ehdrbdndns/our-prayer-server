import { SQSHandler, SQSEvent, SQSRecord } from "aws-lambda";
import { questionHandler } from "./question";
import { SQSMethod } from "../dataType";

const router: {
  [key: string]: ({
    method
  }: {
    method: SQSMethod,
    body: string
  }) => Promise<void>
} = {
  "question": questionHandler,
}

export const handler: SQSHandler = async (event: SQSEvent) => {
  const records: SQSRecord[] = event.Records;

  for (const record of records) {
    const body = record.body;
    const path = record.messageAttributes.Type.stringValue;
    const method = record.messageAttributes.Method.stringValue as SQSMethod;

    if (!path || !method) {
      console.error('bad request: path or method is invalid', path, method);
      continue;
    }

    if (path in router) {
      await router[path]({ method, body });
    }
  }

  return;
}