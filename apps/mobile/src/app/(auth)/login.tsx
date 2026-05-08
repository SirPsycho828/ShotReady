import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useState } from "react";
import { Link } from "expo-router";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginScreen() {
  const { login, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!email) {
      setError("Enter your email address first");
      return;
    }
    setError("");
    try {
      await resetPassword(email.trim());
      setResetSent(true);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Failed to send reset email";
      setError(message);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerClassName="flex-1 justify-center px-lg"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-h1 text-text-primary text-center">
          ShotReady
        </Text>
        <Text className="text-body text-text-secondary text-center mt-sm mb-xl">
          Sign in to continue
        </Text>

        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
        />

        <View className="mt-md">
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            autoComplete="password"
          />
        </View>

        {error !== "" && (
          <Text className="text-small text-error mt-sm">{error}</Text>
        )}

        {resetSent && (
          <Text className="text-small text-success mt-sm">
            Password reset email sent. Check your inbox.
          </Text>
        )}

        <View className="mt-lg">
          <Button title="Sign In" onPress={handleLogin} loading={loading} />
        </View>

        <View className="mt-sm">
          <Button
            title="Forgot Password?"
            variant="ghost"
            onPress={handleResetPassword}
          />
        </View>

        <View className="mt-xl flex-row justify-center">
          <Text className="text-body text-text-secondary">
            {"Don't have an account? "}
          </Text>
          <Link href="/(auth)/register">
            <Text className="text-body text-accent">Sign Up</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
