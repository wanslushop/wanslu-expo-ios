import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { WebView } from "react-native-webview";
import { useAuth } from "./context/AuthContext";
import { useCartCount } from "./context/CartCountContext";
import { useI18n } from "./context/I18nContext";

interface Transfer {
  id: number;
  user_id: number;
  reference: string;
  name: string;
  email: string;
  phone: string;
  amount: string;
  cny: number;
  exchange_rate: number;
  fee: string;
  currency: string;
  payment: number;
  bank_name: string;
  account_number: string;
  country: string;
  note: string | null;
  extra: string | null;
  status: string;
  ip_address: string;
  created_at: string;
  updated_at: string;
  proof?: string;
}

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<{ username: string; email: string }>();
  const [proofModalVisible, setProofModalVisible] = useState(false);
  const [selectedProof, setSelectedProof] = useState<string | null>(null);
  const router = useRouter();
  const { authToken, isAuthenticated } = useAuth();
  const { cartCount } = useCartCount();
  const { t } = useI18n();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    fetchUserData();
    fetchTransfers();
  }, [isAuthenticated, authToken, router]);

  const fetchUserData = async () => {
    if (!authToken) return;
    try {
      const response = await fetch("https://api.wanslu.shop/api/auth/me", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ ping: true }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.status === "success" && data.user) {
          setUser({
            username: data.user.username,
            email: data.user.email,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  const fetchTransfers = async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const response = await fetch(
        "https://api.wanslu.shop/api/account/transfer/history",
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.status === "success") {
          setTransfers(data.data || []);
        } else {
          setTransfers([]);
        }
      } else {
        setTransfers([]);
      }
    } catch (error) {
      console.error("Failed to load transfer history:", error);
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTransfers();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return { color: "#059669", backgroundColor: "#D1FAE5" };
      case "pending":
        return { color: "#D97706", backgroundColor: "#FEF3C7" };
      case "failed":
        return { color: "#DC2626", backgroundColor: "#FEE2E2" };
      default:
        return { color: "#6B7280", backgroundColor: "#F3F4F6" };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const toTitleCase = (text: string) => {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  };

  const isImageFile = (url: string) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const lowerUrl = url.toLowerCase();
    return imageExtensions.some(ext => lowerUrl.includes(ext));
  };

  const isPdfFile = (url: string) => {
    return url.toLowerCase().includes('.pdf');
  };

  const handleViewProof = (proof: string) => {
    const proofUrl = `https://administration.wanslu.shop/${proof}`;
    // Use Google Docs Viewer for PDFs to display inline instead of downloading
    const isPdf = proof.toLowerCase().includes('.pdf') || proofUrl.toLowerCase().includes('.pdf');
    if (isPdf) {
      const encodedUrl = encodeURIComponent(proofUrl);
      setSelectedProof(`https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`);
    } else {
      setSelectedProof(proofUrl);
    }
    setProofModalVisible(true);
  };

  const handleHelpTransfer = (reference: string) => {
    router.push({
      pathname: '/help-support',
      params: { message: `Transfer Help - #${reference}` }
    });
  };

  const renderTransferItem = (item: Transfer) => {
    const statusStyle = getStatusColor(item.status);
    
    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.cardId}>#{item.reference}</Text>
            <Text style={styles.cardTime}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={styles.cardHeaderRight}>
            <Text style={styles.cardAmount}>
              {parseFloat(item.amount).toFixed(2)} {item.currency}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.backgroundColor }]}>
              <Text style={[styles.statusText, { color: statusStyle.color }]}>
                {toTitleCase(item.status)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardRow}>
            <View style={styles.cardLabelValue}>
              <Text style={styles.cardLabel}>{t('transfers.labels.recipient')}</Text>
              <Text style={styles.cardValue} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.cardSubValue} numberOfLines={1}>{item.email}</Text>
            </View>
            <View style={styles.cardLabelValue}>
              <Text style={styles.cardLabel}>{t('transfers.labels.country')}</Text>
              <Text style={styles.cardValue}>{item.country}</Text>
            </View>
          </View>

          <View style={styles.cardRow}>
            <View style={styles.cardLabelValue}>
              <Text style={styles.cardLabel}>{t('transfers.labels.bank')}</Text>
              <Text style={styles.cardValue} numberOfLines={1}>{item.bank_name}</Text>
              <Text style={styles.cardSubValue} numberOfLines={1}>{item.account_number}</Text>
            </View>
            <View style={styles.cardLabelValue}>
              <Text style={styles.cardLabel}>CNY</Text>
              <Text style={styles.cardValue}>¥{item.cny.toFixed(2)}</Text>
            </View>
          </View>

          {item.note && (
            <View style={styles.cardNote}>
              <Text style={styles.cardLabel}>{t('transfers.labels.note')}</Text>
              <Text style={styles.cardValue}>{item.note}</Text>
            </View>
          )}

          <View style={styles.cardPaymentRow}>
            {item.payment === 1 ? (
              <View style={styles.paidBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#059669" />
                <Text style={styles.paidText}>Paid</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.payNowButton}
                onPress={() => router.push({ pathname: '/pay-transfer', params: { reference: item.reference } })}
              >
                <Ionicons name="card" size={14} color="#fff" />
                <Text style={styles.payNowText}>Pay Now</Text>
              </TouchableOpacity>
            )}
          </View>

          {item.status?.toLowerCase() === 'completed' && (
            <View style={styles.cardActions}>
              {item.proof && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleViewProof(item.proof!)}
                >
                  <Ionicons name="document-text" size={14} color="#fff" />
                  <Text style={styles.actionButtonText}>{t('transfers.viewProof')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionButton, styles.helpButton]}
                onPress={() => handleHelpTransfer(item.reference)}
              >
                <Ionicons name="help-circle" size={14} color="#fff" />
                <Text style={styles.actionButtonText}>{t('transfers.help')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
        <View style={styles.header}>
    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
      <Ionicons name="arrow-back" size={24} color="#fff" />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>{t('transfers.title')}</Text>
    <View style={styles.headerSpacer} />
  </View>
      
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.headerContent}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>{t('transfers.title')}</Text>
              <Text style={styles.headerSubtitle}>{t('transfers.moneyTransfers')}</Text>
            </View>
            <TouchableOpacity
              style={styles.newTransferButton}
              onPress={() => router.push("/transfer")}
            >
              <Ionicons name="add" size={20} color="white" />
              <Text style={styles.newTransferButtonText}>{t('transfers.newTransfer')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Transfers List */}
        <View style={styles.transfersContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#E53E3E" />
              <Text style={styles.loadingText}>{t('transfers.loadingTransfers')}</Text>
            </View>
          ) : transfers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={64} color="#CCC" />
              <Text style={styles.emptyTitle}>{t('transfers.emptyTitle')}</Text>
              <Text style={styles.emptySubtitle}>
                {t('transfers.emptySubtitle')}
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push("/transfer")}
              >
                <Text style={styles.emptyButtonText}>{t('transfers.makeFirstTransfer')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.transfersList}>
              {transfers.map(renderTransferItem)}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Proof Modal */}
      <Modal
        visible={proofModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setProofModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('transfers.proofOfTransfer')}</Text>
              <TouchableOpacity
                onPress={() => setProofModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              {selectedProof && (
                <>
                  {isImageFile(selectedProof) ? (
                    <Image
                      source={{ uri: selectedProof }}
                      style={styles.proofImage}
                      resizeMode="contain"
                    />
                  ) : isPdfFile(selectedProof) || selectedProof.includes('docs.google.com/viewer') ? (
                    <WebView
                      source={{ uri: selectedProof }}
                      style={styles.proofWebView}
                      startInLoadingState={true}
                      javaScriptEnabled={true}
                      domStorageEnabled={true}
                      allowsInlineMediaPlayback={true}
                      mediaPlaybackRequiresUserAction={false}
                      scalesPageToFit={true}
                      originWhitelist={['*']}
                      onError={(syntheticEvent) => {
                        const { nativeEvent } = syntheticEvent;
                        console.warn('WebView error: ', nativeEvent);
                      }}
                      onHttpError={(syntheticEvent) => {
                        const { nativeEvent } = syntheticEvent;
                        console.warn('HTTP error: ', nativeEvent);
                      }}
                      renderLoading={() => (
                        <View style={styles.proofLoadingContainer}>
                          <ActivityIndicator size="large" color="#E53E3E" />
                          <Text style={styles.proofLoadingText}>{t('transfers.loadingProof')}</Text>
                        </View>
                      )}
                    />
                  ) : (
                    <View style={styles.proofUnsupportedContainer}>
                      <Ionicons name="document-outline" size={64} color="#9ca3af" />
                      <Text style={styles.proofUnsupportedText}>
                        {t('transfers.proofUnsupported')}
                      </Text>
                      <TouchableOpacity
                        style={styles.openInBrowserButton}
                        onPress={() => {
                          if (selectedProof) {
                            Linking.openURL(selectedProof).catch(err => {
                              Alert.alert(t('common.error'), t('transfers.errors.failedToOpenProof'));
                            });
                          }
                        }}
                      >
                        <Text style={styles.openInBrowserText}>
                          {t('transfers.openInBrowser')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
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
  headerTitle2: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSpacer: {
    width: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  headerSection: {
    backgroundColor: "#E53E3E",
    borderRadius: 12,
    padding: 20,
    marginVertical: 16,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
  },
  newTransferButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  newTransferButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  transfersContainer: {
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
    backgroundColor: "white",
    borderRadius: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: "#E53E3E",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  transfersList: {
    gap: 12,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardHeaderRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  cardId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  cardTime: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  cardAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ef4444',
  },
  cardBody: {
    gap: 10,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  cardLabelValue: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  cardSubValue: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  cardNote: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  cardPaymentRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  paidText: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '600',
  },
  payNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E53E3E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  payNowText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ed2027',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  helpButton: {
    backgroundColor: '#f59e0b',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '95%',
    height: '85%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E53E3E',
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#000',
  },
  proofImage: {
    width: '100%',
    height: '100%',
  },
  proofWebView: {
    flex: 1,
    backgroundColor: '#fff',
    width: '100%',
    height: '100%',
  },
  proofLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  proofLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  proofUnsupportedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fff',
  },
  proofUnsupportedText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  openInBrowserButton: {
    marginTop: 24,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  openInBrowserText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
