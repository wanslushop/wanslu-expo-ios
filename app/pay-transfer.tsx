import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { WebView } from "react-native-webview";
import { useAuth } from "./context/AuthContext";
import { useI18n } from "./context/I18nContext";

export default function PayTransferScreen() {
  const router = useRouter();
  const { reference } = useLocalSearchParams();
  const { authToken, isAuthenticated } = useAuth();
  const { t } = useI18n();

  const [visible, setVisible] = useState(true);
  const [webProgress, setWebProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [paymentBody, setPaymentBody] = useState<string>("");

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (!reference || typeof reference !== "string") {
      Alert.alert("Error", "Missing transfer reference.", [
        {
          text: t('common.ok'),
          onPress: () => router.back(),
        },
      ]);
      return;
    }

    // Fetch user and prepare POST body for payment
    (async () => {
      let uid: string | undefined;
      let username: string | undefined;
      try {
        const response = await fetch("https://api.wanslu.shop/api/auth/me", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ping: true }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.status === "success" && data.user) {
            uid = String(data.user.id);
            username = data.user.username;
          }
        }
      } catch (_e) {}

      const params: Record<string, string> = {
        transfer: reference as string,
        source: "app",
      };
      if (uid) params.uid = uid;
      if (username) params.username = username;

      const body = new URLSearchParams(params).toString();
      setPaymentBody(body);
    })();
  }, [isAuthenticated, reference, router, authToken, t]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            setVisible(false);
            setSubmitting(false);
            router.back();
          }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('transfer.completePayment')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.webviewContainer}>
        {webProgress > 0 && webProgress < 1 && (
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.max(5, Math.floor(webProgress * 100))}%` },
              ]}
            />
          </View>
        )}
        {visible && !!paymentBody && (
          <WebView
            originWhitelist={["*"]}
            source={{
              uri: "https://pay2.wanslu.shop",
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: paymentBody,
            }}
            onLoadStart={() => setWebProgress(0)}
            onLoadProgress={({ nativeEvent }) => setWebProgress(nativeEvent.progress || 0)}
            onLoadEnd={() => setWebProgress(1)}
            onMessage={(event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data || "{}");
                if (data && data.status === "success") {
                  Alert.alert(t('transfer.success'), t('transfer.paymentSuccessful'), [
                    {
                      text: t('common.ok'),
                      onPress: () => {
                        setVisible(false);
                        setSubmitting(false);
                        router.replace('/transfers');
                      },
                    },
                  ]);
                } else if (data && data.status === "failed") {
                  Alert.alert(t('transfer.paymentFailed'), data.message || t('transfer.paymentFailedMsg'));
                  setSubmitting(false);
                }
              } catch (_e) {}
            }}
            onNavigationStateChange={(navState) => {
              const url = navState?.url || "";
              console.log("WebView URL changed:", url);
              if (/success/i.test(url) || /status=success/i.test(url)) {
                Alert.alert(t('transfer.success'), t('transfer.paymentCompleted'), [
                  {
                    text: t('common.ok'),
                    onPress: () => {
                      setVisible(false);
                      setSubmitting(false);
                      router.replace('/transfers');
                    },
                  },
                ]);
              } else if (/fail/i.test(url) || /error/i.test(url)) {
                Alert.alert(t('transfer.paymentFailed'), t('transfer.paymentFailedMsg'));
                setSubmitting(false);
              }
            }}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.webviewLoading}>
                <ActivityIndicator size="large" color="#E53E3E" />
                <Text style={styles.loadingText}>{t('transfer.loadingPayment')}</Text>
              </View>
            )}
            style={styles.webview}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: '#E53E3E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSpacer: {
    width: 24,
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: '#f3f4f6',
  },
  progressBarFill: {
    height: 3,
    backgroundColor: '#ef4444',
  },
  webview: {
    flex: 1,
    backgroundColor: 'white',
  },
  webviewLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});
