import { navigate } from "../navigation/rootNavigation";

type NotificationPayload = Record<string, unknown>;

const asString = (value: unknown) =>
  typeof value === "string" && value.trim().length ? value : null;

export const handleNotificationNavigation = (payload: NotificationPayload = {}) => {
  const type = asString(payload.type);
  const questionId = asString(payload.questionId);
  const questionText = asString(payload.questionText);
  const category = asString(payload.category);
  const countryCode = asString(payload.countryCode);
  const answerId = asString(payload.answerId);
  const hashtagContext = asString(payload.hashtagContext);
  const userId = asString(payload.userId);
  const storySessionId = asString(payload.storySessionId);
  const duetSessionId = asString(payload.duetSessionId);

  switch (type) {
    case "friend_answered_about_you":
    case "new_answer":
    case "approved":
    case "top_answer":
    case "expert_answer":
      if (questionId) {
        navigate("VideoPlayer", {
          highlightAnswerId: answerId,
          questionId,
          refreshKey: Date.now(),
        });
        return;
      }
      break;

    case "streak_at_risk":
    case "group_pressure":
      navigate("Home", {
        autoOpenQuestion: true,
        refreshKey: Date.now(),
      });
      return;

    case "daily_question_live":
      if (questionId) {
        navigate("Mirror", {
          category,
          country: countryCode,
          questionId,
          questionText,
          refreshKey: Date.now(),
        });
        return;
      }

      navigate("Home", {
        autoOpenQuestion: true,
        refreshKey: Date.now(),
      });
      return;

    case "hot_question":
      if (hashtagContext && !questionId) {
        navigate("HashtagFeed", {
          hashtag: hashtagContext,
          refreshKey: Date.now(),
        });
      } else {
        navigate("Mirror", {
          category,
          hashtagContext,
          questionId,
          questionText,
          refreshKey: Date.now(),
        });
      }
      return;

    case "emotion_score_shared":
      navigate("Profile", {
        focusStorySessionId: storySessionId,
        focusUserId: userId,
        refreshKey: Date.now(),
      });
      return;

    case "new_follower":
      navigate("Profile", {
        focusUserId: userId,
        refreshKey: Date.now(),
      });
      return;

    case "referral_joined":
    case "referral_activated":
      navigate("Referral", {
        refreshKey: Date.now(),
      });
      return;

    case "duet_challenge":
    case "duet_complete":
      if (duetSessionId) {
        navigate("Duet", {
          sessionId: duetSessionId,
          refreshKey: Date.now(),
        });
        return;
      }
      break;
  }

  navigate("Notifications", {
    refreshKey: Date.now(),
  });
};
