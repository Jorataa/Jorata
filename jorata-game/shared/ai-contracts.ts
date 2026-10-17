/** All protected operations require a verified Supabase access token. Guests are excluded. */
export type AiMode =
  | "chat"
  | "mention"
  | "summarize"
  | "explain"
  | "draft"
  | "translate"
  | "tasks_suggest"
  | "username";
export type AiTaskSuggestion = { title: string; details: string };
export type AiResult = {
  text: string;
  tasks?: AiTaskSuggestion[];
  classification?: "allowed" | "review" | "disallowed";
  reason?: string;
};
export type GenerateRequest = {
  mode: AiMode;
  request_id: string;
  room_id?: string;
  prompt?: string;
  message_ids?: string[];
  consent: true;
  include_recent?: boolean;
  include_tasks?: boolean;
  source_message_id?: string;
  invocation?: "mention" | "command" | "action";
  username?: string;
  analyze?: boolean;
};
export type AiRequest =
  | GenerateRequest
  | { mode: "open" }
  | { mode: "settings"; room_id: string; enabled: boolean }
  | {
      mode: "tasks_confirm";
      request_id: string;
      confirmation: true;
      items: { index: number; assignee_id?: string; due_date?: string }[];
    }
  | { mode: "report"; user_id: string; message_id?: string; reason: string };
export type AiResponse = AiResult & {
  request_id: string;
  room_id?: string;
  message_id?: string;
  cached: boolean;
  bot: {
    id: "jorata-ai";
    display_name: "JORATA AI";
    provider: "Google Gemini";
  };
};
export type ApiError = { error: string; code: string; request_id: string };
export const JORATA_AI = {
  id: "jorata-ai",
  display_name: "JORATA AI",
  provider: "Google Gemini",
} as const;
/** Existing jr_messages rows now distinguish user and bot senders without impersonating users. */
export type MessageActor =
  | { sender_id: string; bot_id: null; ai_requested_by: null }
  | { sender_id: null; bot_id: "jorata-ai"; ai_requested_by: string };

export type OpenAiResponse = { room_id: string; bot: typeof JORATA_AI };
export type AiSettingsResponse = { room_id: string; enabled: boolean };
export type TaskConfirmationResponse = { task_ids: string[]; cached: boolean };
export type NameReviewResponse =
  | {
      classification: "allowed" | "review" | "disallowed";
      reason: string;
      source: "deterministic";
      appeal?: string;
    }
  | AiResponse;
export type AiResponseFor<R extends AiRequest> = R extends { mode: "open" }
  ? OpenAiResponse
  : R extends { mode: "settings" }
    ? AiSettingsResponse
    : R extends { mode: "tasks_confirm" }
      ? TaskConfirmationResponse
      : R extends { mode: "report" }
        ? { submitted: true; review: "human"; ai_reviewed: false }
        : R extends { mode: "username" }
          ? NameReviewResponse
          : AiResponse;
