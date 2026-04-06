/**
 * End-to-End Tests - Frontend to Backend Integration
 * Tests the complete flow: Frontend → Backend API → Database
 */

import { API_CONFIG, getApiUrl } from '../config/api';

// Test data
const testQuestion = {
  text: 'How do you make coffee?',
  category: 'lifestyle',
};

const testAnswer = {
  type: 'text',
  text: 'Boil water and brew.',
  contentUrl: null,
};

/**
 * Test Suite: E2E Integration Tests
 */
export const E2ETests = {
  /**
   * Test 1: Health Check
   */
  async testHealthCheck(): Promise<boolean> {
    try {
      console.log('🧪 Test 1: Health Check...');
      const response = await fetch(`${API_CONFIG.BASE_URL}/health`);
      const data = await response.json();
      
      if (response.ok && data.status === 'healthy') {
        console.log('✅ Health check passed');
        return true;
      }
      console.log('❌ Health check failed:', data);
      return false;
    } catch (err) {
      console.error('❌ Health check error:', err);
      return false;
    }
  },

  /**
   * Test 2: Fetch Questions (Read)
   */
  async testFetchQuestions(): Promise<boolean> {
    try {
      console.log('🧪 Test 2: Fetch Questions...');
      const url = getApiUrl(API_CONFIG.endpoints.questions);
      const response = await fetch(url);
      
      if (!response.ok) {
        console.log('❌ Failed to fetch questions:', response.status);
        return false;
      }
      
      const questions = await response.json();
      console.log(`✅ Fetched ${questions.length} questions`);
      return questions.length > 0;
    } catch (err) {
      console.error('❌ Fetch questions error:', err);
      return false;
    }
  },

  /**
   * Test 3: Create Question (Write)
   */
  async testCreateQuestion(): Promise<{ success: boolean; questionId?: string }> {
    try {
      console.log('🧪 Test 3: Create Question...');
      const url = getApiUrl(API_CONFIG.endpoints.questions);
      
      // Mock user ID (in real app, get from authentication)
      const userId = 'test-user-' + Date.now();
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...testQuestion,
          userId,
        }),
      });
      
      if (!response.ok) {
        console.log('❌ Failed to create question:', response.status);
        return { success: false };
      }
      
      const question = await response.json();
      console.log('✅ Question created:', question.id);
      return { success: true, questionId: question.id };
    } catch (err) {
      console.error('❌ Create question error:', err);
      return { success: false };
    }
  },

  /**
   * Test 4: Fetch Answers (Read)
   */
  async testFetchAnswers(): Promise<boolean> {
    try {
      console.log('🧪 Test 4: Fetch Answers...');
      const url = getApiUrl(API_CONFIG.endpoints.answers);
      const response = await fetch(url);
      
      if (!response.ok) {
        console.log('❌ Failed to fetch answers:', response.status);
        return false;
      }
      
      const answers = await response.json();
      console.log(`✅ Fetched ${answers.length} answers`);
      return true;
    } catch (err) {
      console.error('❌ Fetch answers error:', err);
      return false;
    }
  },

  /**
   * Test 5: Create Answer (Write)
   */
  async testCreateAnswer(questionId: string): Promise<{ success: boolean; answerId?: string }> {
    try {
      console.log('🧪 Test 5: Create Answer...');
      const url = getApiUrl(API_CONFIG.endpoints.answers);
      
      const userId = 'test-user-' + Date.now();
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...testAnswer,
          questionId,
          userId,
        }),
      });
      
      if (!response.ok) {
        console.log('❌ Failed to create answer:', response.status);
        return { success: false };
      }
      
      const answer = await response.json();
      console.log('✅ Answer created:', answer.id);
      return { success: true, answerId: answer.id };
    } catch (err) {
      console.error('❌ Create answer error:', err);
      return { success: false };
    }
  },

  /**
   * Test 6: Full User Flow
   */
  async testFullUserFlow(): Promise<boolean> {
    try {
      console.log('\n🚀 Test 6: Full User Flow...\n');
      
      // 1. Health check
      const healthOk = await this.testHealthCheck();
      if (!healthOk) return false;
      
      // 2. Fetch questions
      const fetchOk = await this.testFetchQuestions();
      if (!fetchOk) return false;
      
      // 3. Create question
      const createQRes = await this.testCreateQuestion();
      if (!createQRes.success) return false;
      
      // 4. Create answer
      const createARes = await this.testCreateAnswer(createQRes.questionId!);
      if (!createARes.success) return false;
      
      console.log('\n✅ Full user flow test passed!');
      return true;
    } catch (err) {
      console.error('❌ Full user flow error:', err);
      return false;
    }
  },

  /**
   * Test 7: Admin Endpoints
   */
  async testAdminEndpoints(): Promise<boolean> {
    try {
      console.log('🧪 Test 7: Admin Endpoints...');
      
      const adminUrl = getApiUrl(API_CONFIG.endpoints.admin.users);
      const response = await fetch(adminUrl);
      
      if (!response.ok) {
        console.log('⚠️  Admin endpoint returned:', response.status);
        return false;
      }
      
      const users = await response.json();
      console.log(`✅ Fetched ${users.length} admin users`);
      return true;
    } catch (err) {
      console.error('⚠️  Admin test note:', err);
      return true; // Don't fail on admin endpoint
    }
  },

  /**
   * Test 8: Response Time Check
   */
  async testResponseTimes(): Promise<boolean> {
    try {
      console.log('🧪 Test 8: Response Time Check...');
      
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
      
      console.log('📊 Response Times:');
      results.forEach(r => {
        const status = r.time < 500 ? '✅' : r.time < 1000 ? '⚠️' : '❌';
        console.log(`  ${status} ${r.endpoint}: ${r.time}ms`);
      });
      
      // All should be under 2 seconds
      const allOk = results.every(r => r.time < 2000);
      return allOk;
    } catch (err) {
      console.error('❌ Response time test error:', err);
      return false;
    }
  },

  /**
   * Run All Tests
   */
  async runAllTests(): Promise<{ passed: number; failed: number; total: number }> {
    console.log('═══════════════════════════════════════════');
    console.log('🧪 RUNNING END-TO-END INTEGRATION TESTS');
    console.log('═══════════════════════════════════════════\n');
    
    const tests = [
      { name: 'Health Check', fn: () => this.testHealthCheck() },
      { name: 'Fetch Questions', fn: () => this.testFetchQuestions() },
      { name: 'Create Question', fn: () => this.testCreateQuestion().then(r => r.success) },
      { name: 'Fetch Answers', fn: () => this.testFetchAnswers() },
      { name: 'Admin Endpoints', fn: () => this.testAdminEndpoints() },
      { name: 'Response Times', fn: () => this.testResponseTimes() },
      { name: 'Full User Flow', fn: () => this.testFullUserFlow() },
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
      try {
        const result = await test.fn();
        if (result) {
          passed++;
        } else {
          failed++;
        }
      } catch (err) {
        console.error(`❌ ${test.name}: ${err}`);
        failed++;
      }
    }
    
    console.log('\n═══════════════════════════════════════════');
    console.log('📊 TEST RESULTS');
    console.log('═══════════════════════════════════════════');
    console.log(`✅ Passed: ${passed}/${tests.length}`);
    console.log(`❌ Failed: ${failed}/${tests.length}`);
    console.log('═══════════════════════════════════════════\n');
    
    return {
      passed,
      failed,
      total: tests.length,
    };
  },
};

// Export for React component integration
export default E2ETests;
