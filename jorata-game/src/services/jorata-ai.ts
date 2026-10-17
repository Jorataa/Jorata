import type {
  AiRequest,
  AiResponseFor,
  ApiError,
} from "../../shared/ai-contracts";
export type AccessTokenProvider = () => Promise<string | null>;
/** UI-independent integration. Inject the real account token provider; never pass guest IDs. */
export function createJorataAi(
  getAccessToken: AccessTokenProvider,
  options: { endpoint?: string } = {},
) {
  return {
    async request<R extends AiRequest>(
      body: R,
      signal?: AbortSignal,
    ): Promise<AiResponseFor<R>> {
      const token = await getAccessToken();
      if (!token)
        throw new Error("A verified account is required for JORATA AI.");
      const response = await fetch(options.endpoint || "/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal,
      });
      const data = await response.json();
      if (!response.ok) {
        const failure = data as ApiError;
        throw Object.assign(
          new Error(failure.error || "JORATA AI is unavailable."),
          {
            code: failure.code,
            status: response.status,
            requestId: failure.request_id,
          },
        );
      }
      return data as AiResponseFor<R>;
    },
  };
}
