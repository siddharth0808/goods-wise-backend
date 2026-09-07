/* eslint-disable @typescript-eslint/no-explicit-any */

export const logInfo = (fn: string, message: string, data?: any) => {
  if (data) {
    console.log(`[INFO] [${fn}]: ${message}--->`, data);
  } else {
    console.log(`[INFO] [${fn}]: ${message}`);
  }
};

export const logError = (fn: string, message: string, data?: any) => {
  if (data) {
    console.error(`[ERROR] [${fn}]: ${message}--->`, data);
  } else {
    console.error(`[ERROR] [${fn}]: ${message}`);
  }
};

export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
