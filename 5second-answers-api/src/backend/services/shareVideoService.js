const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");

const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;
const VIDEO_DURATION_SECONDS = 7;
const VIDEO_FPS = 30;
const OUTPUT_DIRECTORY = path.join(__dirname, "..", "uploads", "share-videos");

const FONT_CANDIDATES = {
  bold: [
    "C:\\Windows\\Fonts\\arialbd.ttf",
    "C:\\Windows\\Fonts\\seguisb.ttf",
    "C:\\Windows\\Fonts\\segoeuib.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  ],
  regular: [
    "C:\\Windows\\Fonts\\arial.ttf",
    "C:\\Windows\\Fonts\\segoeui.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  ],
};

const SPEED_THEME = {
  fast: {
    accent: "0xFF5C5C",
    badgeLabel: "FAST LOOP",
    timeLabel: "5 SECOND MODE",
  },
  slow: {
    accent: "0xF5A623",
    badgeLabel: "10S MODE",
    timeLabel: "TAKE THE EXTRA BEAT",
  },
};

const normalizeText = (value, fallback = "") =>
  String(value || fallback)
    .replace(/\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const truncateText = (value, maxLength) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

const wrapText = (value, maxCharsPerLine, maxLines) => {
  const words = normalizeText(value).split(" ").filter(Boolean);

  if (!words.length) {
    return "";
  }

  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length <= maxCharsPerLine) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      lines.push(word.slice(0, maxCharsPerLine));
      currentLine = word.slice(maxCharsPerLine);
    }

    if (lines.length === maxLines) {
      break;
    }
  }

  if (lines.length < maxLines && currentLine) {
    lines.push(currentLine);
  }

  const limited = lines.slice(0, maxLines);
  const consumedWords = limited.join(" ").split(" ").filter(Boolean).length;

  if (consumedWords < words.length && limited.length) {
    limited[limited.length - 1] = truncateText(limited[limited.length - 1], maxCharsPerLine);
  }

  return limited.join("\n");
};

const escapeFilterValue = (value) =>
  String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/,/g, "\\,")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/;/g, "\\;")
    .replace(/%/g, "\\%")
    .replace(/\n/g, "\\n");

const resolveFontPath = (kind) => {
  const fontPath = FONT_CANDIDATES[kind].find((candidate) => fs.existsSync(candidate));

  if (!fontPath) {
    throw new Error(`No usable ${kind} font found for video export.`);
  }

  return fontPath.replace(/\\/g, "/").replace(/:/g, "\\:");
};

const ensureOutputDirectory = async () => {
  await fs.promises.mkdir(OUTPUT_DIRECTORY, { recursive: true });
};

const buildDrawText = ({
  fontFile,
  text,
  fontColor,
  fontSize,
  x,
  y,
  lineSpacing = 8,
  box = false,
  boxColor,
  boxBorderWidth = 0,
  alpha,
}) => {
  const parts = [
    `drawtext=fontfile='${fontFile}'`,
    `text='${escapeFilterValue(text)}'`,
    `fontcolor=${fontColor}`,
    `fontsize=${fontSize}`,
    `line_spacing=${lineSpacing}`,
    `x=${x}`,
    `y=${y}`,
  ];

  if (box) {
    parts.push("box=1");
    parts.push(`boxcolor=${boxColor}`);
    parts.push(`boxborderw=${boxBorderWidth}`);
  }

  if (alpha) {
    parts.push(`alpha=${alpha}`);
  }

  return parts.join(":");
};

const renderVideo = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `ffmpeg exited with code ${code}`));
    });
  });

exports.exportAnswerVideo = async ({
  answer,
  aiComment,
  question,
  seconds,
}) => {
  const safeQuestion = normalizeText(question);
  const safeAnswer = normalizeText(answer);
  const safeAiComment = normalizeText(aiComment, "AI said this one hit harder than expected.");
  const safeSeconds = Number.isFinite(Number(seconds)) ? Number(seconds) : 5;

  if (!safeQuestion || !safeAnswer) {
    throw new Error("Question and answer are required for video export.");
  }

  if (!ffmpegPath) {
    throw new Error("ffmpeg binary is not available.");
  }

  await ensureOutputDirectory();

  const theme = safeSeconds <= 5 ? SPEED_THEME.fast : SPEED_THEME.slow;
  const boldFont = resolveFontPath("bold");
  const regularFont = resolveFontPath("regular");
  const questionText = wrapText(safeQuestion, 24, 4);
  const answerText = wrapText(safeAnswer, 17, 5);
  const aiText = wrapText(safeAiComment, 28, 4);
  const filename = `share-video-${Date.now()}-${randomUUID().slice(0, 8)}.mp4`;
  const outputPath = path.join(OUTPUT_DIRECTORY, filename);

  const filterChain = [
    "fade=t=in:st=0:d=0.35",
    "fade=t=out:st=6.35:d=0.45",
    `drawbox=x=48:y=48:w=${VIDEO_WIDTH - 96}:h=${VIDEO_HEIGHT - 96}:color=0x171A24:t=fill`,
    `drawbox=x=48:y=48:w=${VIDEO_WIDTH - 96}:h=12:color=${theme.accent}:t=fill`,
    "drawbox=x=72:y=170:w=936:h=255:color=0x11141D:t=fill",
    "drawbox=x=72:y=488:w=936:h=640:color=0x0D1017:t=fill",
    "drawbox=x=72:y=1188:w=936:h=300:color=0x14101A:t=fill",
    "drawbox=x=72:y=1558:w=936:h=180:color=0x11141D:t=fill",
    buildDrawText({
      fontFile: regularFont,
      text: "5Second.app",
      fontColor: "white@0.46",
      fontSize: 34,
      x: "72",
      y: "96",
      lineSpacing: 0,
    }),
    buildDrawText({
      fontFile: boldFont,
      text: theme.badgeLabel,
      fontColor: theme.accent,
      fontSize: 28,
      x: "760",
      y: "96",
      lineSpacing: 0,
      box: true,
      boxColor: "white@0.08",
      boxBorderWidth: 20,
    }),
    buildDrawText({
      fontFile: regularFont,
      text: "QUESTION",
      fontColor: "white@0.42",
      fontSize: 26,
      x: "108",
      y: "204",
      lineSpacing: 0,
    }),
    buildDrawText({
      fontFile: boldFont,
      text: questionText,
      fontColor: "white",
      fontSize: 62,
      x: "108",
      y: "252",
      lineSpacing: 14,
    }),
    buildDrawText({
      fontFile: regularFont,
      text: "YOUR ANSWER",
      fontColor: "white@0.42",
      fontSize: 28,
      x: "108",
      y: "530",
      lineSpacing: 0,
    }),
    buildDrawText({
      fontFile: boldFont,
      text: answerText,
      fontColor: "white",
      fontSize: 84,
      x: "108",
      y: "610",
      lineSpacing: 18,
      alpha: "'if(lt(t,0.9),0,if(lt(t,1.4),(t-0.9)/0.5,1))'",
    }),
    buildDrawText({
      fontFile: regularFont,
      text: "AI REACTION",
      fontColor: theme.accent,
      fontSize: 26,
      x: "108",
      y: "1222",
      lineSpacing: 0,
    }),
    buildDrawText({
      fontFile: boldFont,
      text: aiText,
      fontColor: "white",
      fontSize: 46,
      x: "108",
      y: "1280",
      lineSpacing: 14,
      alpha: "'if(lt(t,1.8),0,if(lt(t,2.35),(t-1.8)/0.55,1))'",
    }),
    buildDrawText({
      fontFile: boldFont,
      text: `${safeSeconds.toFixed(1)}s`,
      fontColor: theme.accent,
      fontSize: 64,
      x: "108",
      y: "1608",
      lineSpacing: 0,
    }),
    buildDrawText({
      fontFile: regularFont,
      text: theme.timeLabel,
      fontColor: "white@0.62",
      fontSize: 28,
      x: "108",
      y: "1688",
      lineSpacing: 0,
    }),
    buildDrawText({
      fontFile: regularFont,
      text: "Postoje. Reagoje. Ndaje.",
      fontColor: "white@0.42",
      fontSize: 28,
      x: "108",
      y: "1794",
      lineSpacing: 0,
    }),
  ].join(",");

  const args = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=0x0B0D12:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:d=${VIDEO_DURATION_SECONDS}:r=${VIDEO_FPS}`,
    "-vf",
    filterChain,
    "-r",
    String(VIDEO_FPS),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath,
  ];

  await renderVideo(args);

  return {
    durationSeconds: VIDEO_DURATION_SECONDS,
    fileName: filename,
    mimeType: "video/mp4",
    url: `/uploads/share-videos/${filename}`,
  };
};
