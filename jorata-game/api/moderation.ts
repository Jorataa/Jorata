import aiHandler from "../server/ai/handler.js";
import {
  fail,
  respondError,
  type ApiRequest,
  type ApiResponse,
} from "../server/ai/http.js";
export default async function moderation(req: ApiRequest, res: ApiResponse) {
  try {
    const mode = (req.body as { mode?: unknown } | undefined)?.mode;
    if (
      req.method !== "OPTIONS" &&
      !["username", "report"].includes(String(mode))
    )
      fail(
        400,
        "INVALID_MODERATION_ACTION",
        "Choose username validation or a user report.",
      );
    await aiHandler(req, res);
  } catch (e) {
    respondError(res, e);
  }
}
export const config = { maxDuration: 60 };
