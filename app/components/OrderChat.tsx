import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useI18n } from '../context/I18nContext';
import { translateWithCache } from '../utils/translation-cache';

interface ChatMessage {
  id: number;
  fromid: string;
  toid: string;
  message: string;
  img: string | null;
  isread: number;
  time: string;
  created_at: string;
  updated_at: string;
}

interface OrderChatProps {
  visible: boolean;
  onClose: () => void;
  subOrderId: number;
  oid2: string;
  productTitle: string;
}

export const OrderChat: React.FC<OrderChatProps> = ({
  visible,
  onClose,
  subOrderId,
  oid2,
  productTitle,
}) => {
  const { t, language } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translatedMessages, setTranslatedMessages] = useState<Record<number, string>>({});
  const [translatingIds, setTranslatingIds] = useState<Set<number>>(new Set());
  const scrollViewRef = useRef<ScrollView>(null);

  // Helper to get user id for message direction
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) return;
      // Optionally decode JWT to get user id, or fetch user info if needed
      // For now, just store token for possible future use
      setUserId(authToken);
    })();
  }, []);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        throw new Error(t('orderChat.errors.authRequired'));
      }
      const response = await fetch(
        `https://api.wanslu.shop/api/orderchat?oid=${subOrderId}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!response.ok) {
        throw new Error(t('orderChat.errors.failedToFetch'));
      }
      const data = await response.json();
      if (data.status === 'success' && data.data) {
        setMessages(data.data);
      } else {
        throw new Error(data.message || t('orderChat.errors.failedToLoad'));
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  }, [subOrderId]);

  const sendMessage = async () => {
    if (!newMessage.trim()) {
      return;
    }
    setSending(true);
    const messageText = newMessage.trim();
    setNewMessage('');
    // Optimistically add message to UI
    const tempMessage: ChatMessage = {
      id: Date.now(),
      fromid: subOrderId.toString(), // Assume user is sender
      toid: '',
      message: messageText,
      img: null,
      isread: 0,
      time: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMessage]);
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        throw new Error(t('orderChat.errors.authRequired'));
      }
      const formData = new FormData();
      formData.append('oid', subOrderId.toString());
      formData.append('message', messageText);
      const response = await fetch('https://api.wanslu.shop/api/orderchat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      });
      if (!response.ok) {
        throw new Error(t('orderChat.errors.failedToSend'));
      }
      const data = await response.json();
      if (data.status === 'success') {
        fetchMessages(); // Refresh messages
      } else {
        throw new Error(data.message || t('orderChat.errors.failedToSend'));
      }
    } catch (err: any) {
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      setNewMessage(messageText); // Restore message text
      Alert.alert(t('common.error'), err.message || t('orderChat.errors.failedToSend'));
    } finally {
      setSending(false);
    }
  };

  const markAsRead = useCallback(async () => {
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) return;
      await fetch(`https://api.wanslu.shop/api/orderchat/read?oid=${subOrderId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }, [subOrderId]);

  useEffect(() => {
    if (visible) {
      fetchMessages();
      markAsRead();
    }
  }, [visible, fetchMessages, markAsRead]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleTranslate = async (messageId: number, originalText: string) => {
    if (translatingIds.has(messageId)) return;
    
    setTranslatingIds(prev => new Set(prev).add(messageId));
    try {
      const translated = await translateWithCache(originalText, language);
      setTranslatedMessages(prev => ({
        ...prev,
        [messageId]: translated
      }));
    } catch (error) {
      console.error('Translation failed:', error);
    } finally {
      setTranslatingIds(prev => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const renderMessage = (message: ChatMessage) => {
    // User is sender if fromid === subOrderId.toString()
    const isUser = message.fromid === subOrderId.toString();
    const displayText = translatedMessages[message.id] || message.message;
    const isTranslating = translatingIds.has(message.id);
    const isTranslated = !!translatedMessages[message.id];
    
    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.supportMessageContainer,
        ]}
      >
        <View style={styles.messageRow}>
          <View
            style={[
              styles.messageBubble,
              isUser ? styles.userMessageBubble : styles.supportMessageBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isUser ? styles.userMessageText : styles.supportMessageText,
              ]}
            >
              {displayText}
            </Text>
            <View style={styles.messageFooter}>
              <Text
                style={[
                  styles.timestamp,
                  isUser ? styles.userTimestamp : styles.supportTimestamp,
                ]}
              >
                {formatTimestamp(message.time)}
              </Text>
              {!isUser && !message.isread && (
                <View style={styles.unreadDot} />
              )}
            </View>
          </View>
          {!isUser && (
            <TouchableOpacity
              onPress={() => handleTranslate(message.id, message.message)}
              disabled={isTranslating || isTranslated}
              style={styles.translateButton}
            >
              {isTranslating ? (
                <ActivityIndicator size="small" color="#666" />
              ) : (
                <Ionicons 
                  name="language" 
                  size={16} 
                  color={isTranslated ? "#999" : "#666"} 
                />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{t('orderChat.title')}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {productTitle}
            </Text>
            <Text style={styles.headerId}>{t('orderChat.id')} {oid2}</Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ef4444" />
              <Text style={styles.loadingText}>{t('orderChat.loadingMessages')}</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={48} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={fetchMessages}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <ScrollView
                ref={scrollViewRef}
                style={styles.messagesContainer}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
              >
                {messages.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="chatbubbles-outline" size={48} color="#9ca3af" />
                    <Text style={styles.emptyText}>{t('orderChat.emptyTitle')}</Text>
                    <Text style={styles.emptySubtext}>
                      {t('orderChat.emptySubtitle')}
                    </Text>
                  </View>
                ) : (
                  messages.map(renderMessage)
                )}
              </ScrollView>

              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.textInput}
                    value={newMessage}
                    onChangeText={setNewMessage}
                    placeholder={t('orderChat.placeholder')}
                    multiline
                    maxLength={500}
                    editable={!sending}
                  />
                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      (!newMessage.trim() || sending) && styles.sendButtonDisabled,
                    ]}
                    onPress={sendMessage}
                    disabled={!newMessage.trim() || sending}
                  >
                    {sending ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Ionicons name="send" size={20} color="white" />
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={styles.characterCount}>
                  {newMessage.length}/500
                </Text>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ed2027',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  headerId: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 1,
  },
  chatContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 4,
  },
  messageContainer: {
    marginBottom: 12,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  supportMessageContainer: {
    alignItems: 'flex-start',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    maxWidth: '85%',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  userMessageBubble: {
    backgroundColor: '#ef4444',
    borderBottomRightRadius: 4,
  },
  supportMessageBubble: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  userMessageText: {
    color: 'white',
  },
  supportMessageText: {
    color: '#111827',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 12,
  },
  userTimestamp: {
    color: 'rgba(255,255,255,0.7)',
  },
  supportTimestamp: {
    color: '#9ca3af',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginLeft: 8,
  },
  translateButton: {
    marginLeft: 6,
    padding: 6,
    alignSelf: 'center',
  },
  inputContainer: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f3f4f6',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 48,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    backgroundColor: '#ef4444',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  characterCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 4,
  },
});
