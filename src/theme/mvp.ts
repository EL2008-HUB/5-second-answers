export let MVP_USER_ID = "demo_user";

export const setMvpUserId = (value?: string | null) => {
  const nextValue = String(value || "").trim();
  MVP_USER_ID = nextValue || "demo_user";
};

export const colors = {
  bg: "#0B0B0F",
  panel: "rgba(255,255,255,0.03)",
  panelBorder: "rgba(255,255,255,0.08)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,0.68)",
  soft: "#F4E7DD",
  accent: "#FF4D4D",
  accentWarm: "#FF8A00",
  track: "#1A1A1F",
};

export const categoryChips = [
  { id: "all", label: "All", emoji: "✨" },
  { id: "funny", label: "Funny", emoji: "😂" },
  { id: "emotional", label: "Emotional", emoji: "💔" },
  { id: "savage", label: "Savage", emoji: "🔥" },
  { id: "self-growth", label: "Growth", emoji: "🧠" },
  { id: "relationships", label: "Love", emoji: "🫶" },
  { id: "mindset", label: "Mindset", emoji: "🎯" },
];

export const formatCompactNumber = (value = 0) => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1).replace(/\.0$/, "")}k`;
  }

  return `${value}`;
};

export const formatCountdown = (seconds = 0) => {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  return `${hours}h ${minutes}m`;
};

export const readJsonSafely = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Expected JSON but received: ${text.slice(0, 80)}`);
  }
};
