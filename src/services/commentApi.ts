import { getApiUrl } from "../config/api";

type CommentContext = {
  answer?: string | null;
  answerId?: string | null;
  langCode?: string | null;
  question?: string | null;
  userId?: string | null;
};

const buildQuery = (context: CommentContext = {}) => {
  const params = new URLSearchParams();

  Object.entries(context).forEach(([key, value]) => {
    if (value) {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  return query ? `?${query}` : "";
};

export const fetchComments = async (threadId: string, context: CommentContext = {}) => {
  const res = await fetch(getApiUrl(`/api/comments/${threadId}${buildQuery(context)}`));
  return await res.json();
};

export const addComment = async (threadId: string, text: string, context: CommentContext = {}) => {
  const res = await fetch(getApiUrl(`/api/comments/${threadId}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...context,
      text,
    }),
  });

  return {
    data: await res.json(),
    ok: res.ok,
    status: res.status,
  };
};
