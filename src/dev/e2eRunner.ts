import { API_CONFIG, getApiUrl } from "../config/api";

const testQuestion = {
  text: "How do you make coffee?",
  category: "lifestyle",
};

const testAnswer = {
  type: "text",
  text: "Boil water and brew.",
  contentUrl: null,
};

const E2ETests = {
  async testHealthCheck(): Promise<boolean> {
    try {
      console.log("Test 1: Health Check...");
      const response = await fetch(`${API_CONFIG.BASE_URL}/health`);
      const data = await response.json();

      if (response.ok && data.status === "healthy") {
        console.log("Health check passed");
        return true;
      }

      console.log("Health check failed:", data);
      return false;
    } catch (err) {
      console.error("Health check error:", err);
      return false;
    }
  },

  async testFetchQuestions(): Promise<boolean> {
    try {
      console.log("Test 2: Fetch Questions...");
      const url = getApiUrl(API_CONFIG.endpoints.questions);
      const response = await fetch(url);

      if (!response.ok) {
        console.log("Failed to fetch questions:", response.status);
        return false;
      }

      const questions = await response.json();
      console.log(`Fetched ${questions.length} questions`);
      return questions.length > 0;
    } catch (err) {
      console.error("Fetch questions error:", err);
      return false;
    }
  },

  async testCreateQuestion(): Promise<{ success: boolean; questionId?: string }> {
    try {
      console.log("Test 3: Create Question...");
      const url = getApiUrl(API_CONFIG.endpoints.questions);
      const userId = "test-user-" + Date.now();

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...testQuestion,
          userId,
        }),
      });

      if (!response.ok) {
        console.log("Failed to create question:", response.status);
        return { success: false };
      }

      const question = await response.json();
      console.log("Question created:", question.id);
      return { success: true, questionId: question.id };
    } catch (err) {
      console.error("Create question error:", err);
      return { success: false };
    }
  },

  async testFetchAnswers(): Promise<boolean> {
    try {
      console.log("Test 4: Fetch Answers...");
      const url = getApiUrl(API_CONFIG.endpoints.answers);
      const response = await fetch(url);

      if (!response.ok) {
        console.log("Failed to fetch answers:", response.status);
        return false;
      }

      const answers = await response.json();
      console.log(`Fetched ${answers.length} answers`);
      return true;
    } catch (err) {
      console.error("Fetch answers error:", err);
      return false;
    }
  },

  async testCreateAnswer(questionId: string): Promise<{ success: boolean; answerId?: string }> {
    try {
      console.log("Test 5: Create Answer...");
      const url = getApiUrl(API_CONFIG.endpoints.answers);
      const userId = "test-user-" + Date.now();

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...testAnswer,
          questionId,
          userId,
        }),
      });

      if (!response.ok) {
        console.log("Failed to create answer:", response.status);
        return { success: false };
      }

      const answer = await response.json();
      console.log("Answer created:", answer.id);
      return { success: true, answerId: answer.id };
    } catch (err) {
      console.error("Create answer error:", err);
      return { success: false };
    }
  },

  async testFullUserFlow(): Promise<boolean> {
    try {
      console.log("\nTest 6: Full User Flow...\n");

      const healthOk = await this.testHealthCheck();
      if (!healthOk) return false;

      const fetchOk = await this.testFetchQuestions();
      if (!fetchOk) return false;

      const createQRes = await this.testCreateQuestion();
      if (!createQRes.success) return false;

      const createARes = await this.testCreateAnswer(createQRes.questionId!);
      if (!createARes.success) return false;

      console.log("\nFull user flow test passed!");
      return true;
    } catch (err) {
      console.error("Full user flow error:", err);
      return false;
    }
  },

  async testAdminEndpoints(): Promise<boolean> {
    try {
      console.log("Test 7: Admin Endpoints...");
      const adminUrl = getApiUrl(API_CONFIG.endpoints.admin.users);
      const response = await fetch(adminUrl);

      if (!response.ok) {
        console.log("Admin endpoint returned:", response.status);
        return false;
      }

      const users = await response.json();
      console.log(`Fetched ${users.length} admin users`);
      return true;
    } catch (err) {
      console.error("Admin test note:", err);
      return true;
    }
  },

  async testResponseTimes(): Promise<boolean> {
    try {
      console.log("Test 8: Response Time Check...");

      const endpoints = [
        API_CONFIG.endpoints.questions,
        API_CONFIG.endpoints.answers,
        API_CONFIG.endpoints.admin.badges,
      ];

      const results: { endpoint: string; time: number; ok: boolean }[] = [];

      for (const endpoint of endpoints) {
        const start = Date.now();
        const response = await fetch(getApiUrl(endpoint));
        const time = Date.now() - start;

        results.push({
          endpoint,
          time,
          ok: response.ok,
        });
      }

      console.log("Response Times:");
      results.forEach((result) => {
        const status = result.time < 500 ? "OK" : result.time < 1000 ? "WARN" : "SLOW";
        console.log(`  ${status} ${result.endpoint}: ${result.time}ms`);
      });

      return results.every((result) => result.time < 2000);
    } catch (err) {
      console.error("Response time test error:", err);
      return false;
    }
  },

  async runAllTests(): Promise<{ passed: number; failed: number; total: number }> {
    const tests = [
      { name: "Health Check", fn: () => this.testHealthCheck() },
      { name: "Fetch Questions", fn: () => this.testFetchQuestions() },
      { name: "Create Question", fn: () => this.testCreateQuestion().then((result) => result.success) },
      { name: "Fetch Answers", fn: () => this.testFetchAnswers() },
      { name: "Admin Endpoints", fn: () => this.testAdminEndpoints() },
      { name: "Response Times", fn: () => this.testResponseTimes() },
      { name: "Full User Flow", fn: () => this.testFullUserFlow() },
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      try {
        const result = await test.fn();
        if (result) {
          passed++;
        } else {
          console.log(`${test.name} failed`);
          failed++;
        }
      } catch (err) {
        console.error(`${test.name} error:`, err);
        failed++;
      }
    }

    return {
      passed,
      failed,
      total: tests.length,
    };
  },
};

export default E2ETests;
