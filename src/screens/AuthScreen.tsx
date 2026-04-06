import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

import { API_CONFIG, getApiUrl } from "../config/api";
import { saveAuthSession } from "../services/authService";
import {
  detectDeviceCountry,
  getCountryOption,
  resolveCountryCode,
  SUPPORTED_COUNTRIES,
  syncHomeCountry,
} from "../services/countryService";
import { colors, readJsonSafely } from "../theme/mvp";

type AuthMode = "signup" | "login";

type AuthResponse = {
  error?: string;
  user?: {
    id: string;
    username: string;
    createdAt?: string | null;
    homeCountry?: string | null;
  };
};

export default function AuthScreen() {
  const navigation = useNavigation<any>();
  const [mode, setMode] = useState<AuthMode>("signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(() => detectDeviceCountry());
  const selectedCountryOption = useMemo(
    () => getCountryOption(selectedCountry),
    [selectedCountry]
  );

  const title = useMemo(
    () => (mode === "signup" ? "Krijo llogarine tende." : "Hyr ne llogarine tende."),
    [mode]
  );

  const submit = async () => {
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setError("Ploteso username dhe password.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const endpoint =
        mode === "signup"
          ? API_CONFIG.endpoints.auth.signup
          : API_CONFIG.endpoints.auth.login;

      const response = await fetch(getApiUrl(endpoint), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          homeCountry: selectedCountry,
          username: cleanUsername,
          password: cleanPassword,
        }),
      });

      const data = (await readJsonSafely(response)) as AuthResponse | null;

      if (!response.ok || !data?.user) {
        throw new Error(data?.error || "Auth failed");
      }

      await saveAuthSession(data.user);
      await syncHomeCountry(data.user.homeCountry || selectedCountry);

      navigation.reset({
        index: 0,
        routes: [{ name: "LaunchGate" }],
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
    >
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      <View style={styles.card}>
        <Text style={styles.eyebrow}>JAVA 1 AUTH</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          Signup dhe login bazik per ta hequr flow-n me `demo_user` dhe per ta bere app-in MVP real.
        </Text>

        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeButton, mode === "signup" && styles.modeButtonActive]}
            onPress={() => setMode("signup")}
          >
            <Text style={[styles.modeText, mode === "signup" && styles.modeTextActive]}>Signup</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === "login" && styles.modeButtonActive]}
            onPress={() => setMode("login")}
          >
            <Text style={[styles.modeText, mode === "login" && styles.modeTextActive]}>Login</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.countryCard}>
          <Text style={styles.countryEyebrow}>STEP 1</Text>
          <Text style={styles.countryTitle}>Ku je aktualisht?</Text>
          <Text style={styles.countryDetected}>
            Detected: {selectedCountryOption.flag} {selectedCountryOption.label}
          </Text>
          <View style={styles.countryActions}>
            <TouchableOpacity
              style={[styles.countryActionButton, styles.countryActionPrimary]}
              onPress={() => setShowCountryPicker(false)}
            >
              <Text style={styles.countryActionPrimaryText}>Konfirmo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.countryActionButton}
              onPress={() => setShowCountryPicker((current) => !current)}
            >
              <Text style={styles.countryActionSecondaryText}>Ndrysho</Text>
            </TouchableOpacity>
          </View>

          {showCountryPicker ? (
            <View style={styles.countryList}>
              <Text style={styles.countryStepLabel}>STEP 2</Text>
              {SUPPORTED_COUNTRIES.map((country) => (
                <TouchableOpacity
                  key={country.code}
                  style={[
                    styles.countryOptionRow,
                    resolveCountryCode(selectedCountry) === country.code && styles.countryOptionRowActive,
                  ]}
                  onPress={() => {
                    setSelectedCountry(country.code);
                    setShowCountryPicker(false);
                  }}
                >
                  <Text style={styles.countryOptionFlag}>{country.flag}</Text>
                  <Text style={styles.countryOptionText}>{country.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
          onChangeText={setUsername}
          placeholder="username"
          placeholderTextColor="rgba(255,255,255,0.36)"
          style={styles.input}
          value={username}
        />

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
          onChangeText={setPassword}
          placeholder="password"
          placeholderTextColor="rgba(255,255,255,0.36)"
          secureTextEntry
          style={styles.input}
          value={password}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity style={styles.primaryButton} onPress={() => void submit()} disabled={loading}>
          <View style={styles.primaryGlow} />
          {loading ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.primaryText}>{mode === "signup" ? "Krijo account" : "Hyr"}</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.helperText}>
          Username: 3-24 karaktere. Password: minimumi 4 karaktere.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: colors.bg,
  },
  glowTop: {
    position: "absolute",
    top: -120,
    left: -40,
    right: -40,
    height: 260,
    borderRadius: 260,
    backgroundColor: "rgba(255,138,0,0.10)",
  },
  glowBottom: {
    position: "absolute",
    right: -80,
    bottom: -40,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: "rgba(255,77,77,0.08)",
  },
  card: {
    padding: 22,
    borderRadius: 24,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  eyebrow: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textAlign: "center",
  },
  title: {
    marginTop: 12,
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    textAlign: "center",
  },
  modeRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  modeButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  modeButtonActive: {
    backgroundColor: "rgba(255,138,0,0.12)",
    borderColor: "rgba(255,138,0,0.28)",
  },
  modeText: {
    color: colors.soft,
    fontSize: 13,
    fontWeight: "800",
  },
  modeTextActive: {
    color: colors.text,
  },
  countryCard: {
    marginTop: 18,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  countryEyebrow: {
    color: colors.accentWarm,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  countryTitle: {
    marginTop: 8,
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  countryDetected: {
    marginTop: 8,
    color: colors.soft,
    fontSize: 14,
    fontWeight: "700",
  },
  countryActions: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  countryActionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  countryActionPrimary: {
    backgroundColor: "rgba(255,138,0,0.16)",
    borderColor: "rgba(255,138,0,0.28)",
  },
  countryActionPrimaryText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  countryActionSecondaryText: {
    color: colors.soft,
    fontSize: 13,
    fontWeight: "800",
  },
  countryList: {
    marginTop: 14,
    gap: 10,
  },
  countryStepLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
  },
  countryOptionRow: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  countryOptionRowActive: {
    borderColor: "rgba(255,138,0,0.28)",
    backgroundColor: "rgba(255,138,0,0.10)",
  },
  countryOptionFlag: {
    fontSize: 18,
  },
  countryOptionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  errorText: {
    marginTop: 14,
    color: "#FF8E8E",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 48,
    marginTop: 18,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.accent,
  },
  primaryGlow: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: "48%",
    backgroundColor: colors.accentWarm,
  },
  primaryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  helperText: {
    marginTop: 14,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    textAlign: "center",
  },
});
