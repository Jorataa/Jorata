import { createAiHandler } from "../server/ai/handler.js";
// Apply the shared CORS, method, body and identity checks even to invalid actions.
export default createAiHandler(undefined, ["username", "report"]);
export const config = { maxDuration: 60 };
