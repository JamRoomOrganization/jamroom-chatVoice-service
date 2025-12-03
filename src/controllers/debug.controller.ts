import { Request, Response } from 'express';
import { buildSuccessResponse, createMeta } from '../utils/response';

/**
 * Echo response data structure.
 */
interface EchoData {
  received: {
    message: string;
  };
  timestamp: string;
}

/**
 * Echo controller - echoes back the received message.
 *
 * POST /debug/echo
 *
 * Request body (validated by Zod):
 * ```json
 * {
 *   "message": "Hello, world!"
 * }
 * ```
 *
 * Response:
 * ```json
 * {
 *   "data": {
 *     "received": {
 *       "message": "Hello, world!"
 *     },
 *     "timestamp": "<ISO8601>"
 *   },
 *   "error": null,
 *   "meta": {
 *     "requestId": "<uuid>",
 *     "timestamp": "<ISO8601>"
 *   }
 * }
 * ```
 */
export function echo(req: Request, res: Response): void {
  const { message } = req.body as { message: string };

  const echoData: EchoData = {
    received: {
      message,
    },
    timestamp: new Date().toISOString(),
  };

  const response = buildSuccessResponse(echoData, createMeta(req));

  res.status(200).json(response);
}
