import { getApiUrl } from "../config/api";

export const fetchVideos = async () => {
  const res = await fetch(getApiUrl("/api/videos"));
  return await res.json();
};

export const likeVideo = async (id: string) => {
  await fetch(getApiUrl(`/api/videos/${id}/like`), {
    method: "POST",
  });
};
