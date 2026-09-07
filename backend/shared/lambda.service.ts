/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable preserve-caught-error */
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { LambdaEvent } from "../types/invoices";

const lambda = new LambdaClient({});

export class LambdaService {
  constructor() {}

  public async invokeAsync(fn: string, event: LambdaEvent): Promise<void> {
    try {
      await lambda.send(
        new InvokeCommand({
          FunctionName: fn,
          InvocationType: "Event",
          Payload: Buffer.from(JSON.stringify(event)),
        }),
      );
    } catch (error:any) {
        throw Error(error.message);
    }
  }
}
export const lambdaService = new LambdaService();