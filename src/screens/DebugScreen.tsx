/**
 * Debug Screen - E2E Test Runner
 * Used during development to verify frontend-backend integration
 * 
 * Run this screen to test:
 * - API connectivity
 * - Database integration
 * - Response times
 * - Full user flows
 */

import React, { useState } from 'react';
import { View, ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import E2ETests from "../dev/e2eRunner";
import { API_CONFIG } from '../config/api';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  time?: number;
}

export default function DebugScreen() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<{ passed: number; failed: number; total: number } | null>(null);

  const handleRunTests = async () => {
    setRunning(true);
    setResults([]);
    setSummary(null);
    
    try {
      const summary = await E2ETests.runAllTests();
      setSummary(summary);
      
      // Parse results from console (in production, return structured data)
      console.log('Test results captured');
    } catch (err) {
      console.error('Error running tests:', err);
    }
    
    setRunning(false);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🧪 E2E Integration Tests</Text>
        <Text style={styles.subtitle}>Frontend ↔ Backend Verification</Text>
      </View>

      {/* API Configuration */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📡 API Configuration</Text>
        <View style={styles.configBox}>
          <Text style={styles.configText}>🔗 Base URL: {API_CONFIG.BASE_URL}</Text>
          <Text style={styles.configText}>🌍 Environment: {API_CONFIG.ENV}</Text>
          <Text style={styles.configText}>⏱️ Timeout: {API_CONFIG.timeout}ms</Text>
        </View>
      </View>

      {/* Test Summary */}
      {summary && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Test Summary</Text>
          <View style={[styles.summaryBox, summary.failed === 0 ? styles.successBox : styles.failBox]}>
            <Text style={styles.summaryText}>✅ Passed: {summary.passed}/{summary.total}</Text>
            {summary.failed > 0 && (
              <Text style={styles.summaryText}>❌ Failed: {summary.failed}/{summary.total}</Text>
            )}
            {summary.failed === 0 && (
              <Text style={styles.successText}>🎉 All tests passed!</Text>
            )}
          </View>
        </View>
      )}

      {/* Test Results */}
      {results.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧪 Test Results</Text>
          {results.map((result, index) => (
            <View
              key={index}
              style={[
                styles.resultItem,
                result.passed ? styles.resultPassed : styles.resultFailed,
              ]}
            >
              <Text style={styles.resultName}>
                {result.passed ? '✅' : '❌'} {result.name}
              </Text>
              {result.time && <Text style={styles.resultTime}>{result.time}ms</Text>}
              {result.error && <Text style={styles.resultError}>{result.error}</Text>}
            </View>
          ))}
        </View>
      )}

      {/* Run Tests Button */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.button, running && styles.buttonDisabled]}
          onPress={handleRunTests}
          disabled={running}
        >
          <Text style={styles.buttonText}>
            {running ? '⏳ Running Tests...' : '🚀 Run E2E Tests'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Instructions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 How to Use</Text>
        <Text style={styles.instructionText}>
          1. Ensure backend API is running on {API_CONFIG.BASE_URL}{'\n'}
          2. Click "Run E2E Tests" button{'\n'}
          3. Wait for all tests to complete{'\n'}
          4. Check console for detailed logs{'\n'}
          5. Results will appear above{'\n\n'}
          ✅ Green = Test passed{'\n'}
          ❌ Red = Test failed{'\n\n'}
          Check the console for detailed error messages.
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Debug Mode - Remove before production deployment
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    marginBottom: 24,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  configBox: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  configText: {
    fontSize: 13,
    color: '#555',
    marginBottom: 8,
    fontFamily: 'Menlo',
  },
  summaryBox: {
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
  },
  successBox: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  failBox: {
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  successText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
    marginTop: 8,
  },
  resultItem: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  resultPassed: {
    backgroundColor: '#E8F5E9',
    borderLeftColor: '#4CAF50',
  },
  resultFailed: {
    backgroundColor: '#FFEBEE',
    borderLeftColor: '#F44336',
  },
  resultName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  resultTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  resultError: {
    fontSize: 12,
    color: '#F44336',
    marginTop: 4,
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
  },
  footer: {
    marginTop: 20,
    marginBottom: 40,
    paddingVertical: 12,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
});
