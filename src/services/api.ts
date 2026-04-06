import { API_CONFIG, getApiUrl } from "../config/api";

export const BASE_URL = API_CONFIG.BASE_URL;

export const fetchVideos = async () => {
  try {
    const endpoint = "/api/videos";
    console.log("Fetching videos from:", getApiUrl(endpoint));

    const res = await fetch(getApiUrl(endpoint));

    if (!res.ok) {
      throw new Error(`Failed to fetch videos: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error("Fetch videos error:", error);
    throw error;
  }
};

export const uploadVideo = async (videoUri: string) => {
  try {
    const formData = new FormData();

    formData.append("video", {
      uri: videoUri,
      name: "video.mp4",
      type: "video/mp4",
    } as any);

    console.log("Uploading video to:", getApiUrl(API_CONFIG.endpoints.upload));

    const res = await fetch(getApiUrl(API_CONFIG.endpoints.upload), {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    if (!res.ok) {
      throw new Error(`Upload failed: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error("Upload video error:", error);
    throw error;
  }
};
