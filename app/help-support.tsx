import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import { useCartCount } from './context/CartCountContext';
import { useI18n } from './context/I18nContext';
import { translateWithCache } from './utils/translation-cache';


interface ChatMessage {
  id: number;
  fromid: string;
  toid: string;
  message: string;
  time: string;
}

interface FAQ {
  id: number;
  question: string;
  answer: string;
  img?: string;
}

type SupportScreen = 'main' | 'chat' | 'faq';

const fetchFaqs = async () => {
  try {
    const response = await fetch('https://api.wanslu.shop/api/etc/faqs', {
      headers: { Accept: 'application/json' },
    });
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Failed to fetch FAQs:', error);
    return [];
  }
};

function ChatWidget({ onClose, initialMessage }: { onClose: () => void; initialMessage?: string }) {
  const { t, language } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState(initialMessage || '');
  const [sending, setSending] = useState(false);
  const [translatedMessages, setTranslatedMessages] = useState<Record<number, string>>({});
  const [translatingIds, setTranslatingIds] = useState<Set<number>>(new Set());
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  useEffect(() => {
    if (initialMessage) {
      setInput(initialMessage);
    }
  }, [initialMessage]);

  const fetchChat = async () => {
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) return;
      
      setLoading(true);
      const response = await fetch('https://api.wanslu.shop/api/chat', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) return;
      
      await fetch('https://api.wanslu.shop/api/chat/read', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  useEffect(() => {
    markAsRead();
    fetchChat();
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) return;
      
      setSending(true);
      const response = await fetch('https://api.wanslu.shop/api/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toid: 'admin',
          message: input,
          parentUrl: 'mobile-app'
        })
      });
      
      if (response.ok) {
        setInput('');
        fetchChat();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

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

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.fromid !== 'admin';
    const messageTime = new Date(item.time).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const displayText = translatedMessages[item.id] || item.message;
    const isTranslating = translatingIds.has(item.id);
    const isTranslated = !!translatedMessages[item.id];

    return (
      <View style={[styles.messageContainer, isUser ? styles.messageUser : styles.messageAdmin]}>
        <View style={styles.messageRow}>
          <View style={[styles.messageBubble, isUser ? styles.messageBubbleUser : styles.messageBubbleAdmin]}>
            <Text style={[styles.messageText, isUser ? styles.messageTextUser : styles.messageTextAdmin]}>
              {displayText}
            </Text>
          </View>
          {!isUser && (
            <TouchableOpacity
              onPress={() => handleTranslate(item.id, item.message)}
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
        <Text style={styles.messageTime}>{messageTime}</Text>
      </View>
    );
  };

  return (
    <View style={styles.chatContainer}>
      {/* Header */}
      <View style={styles.chatHeader}>
        <View style={styles.chatHeaderLeft}>
          <Image source={require('./assets/logo-red.png')} style={styles.chatLogo} />
          <View>
            <Text style={styles.chatTitle}>{t('helpSupport.wansluSupport')}</Text>
            <Text style={styles.chatStatus}>● {t('helpSupport.online')}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Welcome Message */}
      {messages.length === 0 && !loading && (
        <View style={styles.welcomeContainer}>
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeTitle}>{t('helpSupport.askAQuestion')}</Text>
            <Text style={styles.welcomeSubtitle}>{t('helpSupport.chatWithOurSupport')}</Text>
          </View>
          <TextInput
            placeholderTextColor="#999" placeholder={t('helpSupport.searchForHelp')}
            style={styles.searchInput}
            editable={false}
          />
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#E53E3E" />
              <Text style={styles.loadingText}>{t('common.loading')}</Text>
            </View>
          ) : null
        }
      />

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          placeholderTextColor="#999" placeholder={t('helpSupport.typeYourMessage')}
          value={input}
          onChangeText={setInput}
          style={styles.messageInput}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          onPress={sendMessage}
          disabled={sending || !input.trim()}
          style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function HelpSupportScreen() {
  const router = useRouter();
  const { cartCount } = useCartCount();
  const { t } = useI18n();
  const { message } = useLocalSearchParams<{ message?: string }>();
  
  const [screen, setScreen] = useState<SupportScreen>(message ? 'chat' : 'main');
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [faqLoading, setFaqLoading] = useState(false);
  const [faqError, setFaqError] = useState<string | null>(null);
  const [faqSearch, setFaqSearch] = useState('');
  const [openFaqId, setOpenFaqId] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    checkLoginStatus();
    if (faqs.length === 0 && !faqLoading) {
      loadFaqs();
    }
  }, []);

  const checkLoginStatus = async () => {
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      setIsLoggedIn(!!authToken);
    } catch (error) {
      setIsLoggedIn(false);
    }
  };

  const loadFaqs = async () => {
    setFaqLoading(true);
    setFaqError(null);
    try {
      const data = await fetchFaqs();
      setFaqs(data);
    } catch (error) {
      setFaqError(t('helpSupport.failedToLoadFaqs'));
    } finally {
      setFaqLoading(false);
    }
  };

  const filteredFaqs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(faqSearch.toLowerCase())
  );

  const renderMainScreen = () => (
    <View style={styles.container}>
    
      
      <View style={styles.content}>
        {/* Hero Section */}
        <LinearGradient
      colors={['#ed2027', '#f77075']} // gradient colors (to, from)
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.heroSection}
    >
          <View style={styles.heroHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
            <View style={styles.heroBg}>
            <Image source={require('./assets/logo-red.png')} style={styles.heroLogo} />
            </View>
            <Text style={styles.heroTitle}>{t('helpSupport.wansluSupport')}</Text>
          </View>
          <Text style={styles.heroGreeting}>{t('helpSupport.heyThere')} 👋</Text>
          <Text style={styles.heroQuestion}>{t('helpSupport.howCanWeHelp')}</Text>
        </LinearGradient>

        {/* Options */}
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={styles.optionButton}
            onPress={() => setScreen('chat')}
            disabled={!isLoggedIn}
          >
            <View style={styles.optionContent}>
              <View>
                <Text style={[styles.optionTitle, !isLoggedIn && styles.optionTitleDisabled]}>
                  {isLoggedIn ? t('helpSupport.askAQuestion') : t('helpSupport.loginToContinueToChat')}
                </Text>
                <Text style={styles.optionSubtitle}>{t('helpSupport.chatWithOurSupport')}</Text>
              </View>
              <Image source={require('./assets/logo-red.png')} style={styles.optionIcon} />
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* FAQ Preview */}
          <View style={styles.faqPreview}>
            {faqLoading ? (
              <View style={styles.faqLoading}>
                <ActivityIndicator size="small" color="#E53E3E" />
                <Text style={styles.faqLoadingText}>{t('helpSupport.loadingFaqs')}</Text>
              </View>
            ) : faqError ? (
              <Text style={styles.faqError}>{faqError}</Text>
            ) : (
              <>
                {faqs.slice(0, 4).map(faq => (
                  <TouchableOpacity
                    key={faq.id}
                    style={styles.faqPreviewItem}
                    onPress={() => {
                      setScreen('faq');
                      setOpenFaqId(faq.id);
                    }}
                  >
                    <Text style={styles.faqPreviewQuestion}>{faq.question}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#999" />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.seeAllButton}
                  onPress={() => setScreen('faq')}
                >
                  <Text style={styles.seeAllText}>{t('helpSupport.seeAllFaqs')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </View>
  );

  const renderFaqScreen = () => (
    <View style={styles.container}>
      {/* Custom Header with Back Button */}
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => setScreen('main')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('helpSupport.faqs')}</Text>
        <View style={styles.headerSpacer} />
      </View>
      
      <View style={styles.content}>

        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            placeholderTextColor="#999" placeholder={t('helpSupport.search')}
            value={faqSearch}
            onChangeText={setFaqSearch}
            style={styles.searchInput}
          />
        </View>

        {/* FAQ List */}
        <ScrollView style={styles.faqList} showsVerticalScrollIndicator={false}>
          {faqLoading && (
            <View style={styles.faqLoading}>
              <ActivityIndicator size="large" color="#E53E3E" />
              <Text style={styles.faqLoadingText}>{t('common.loading')}</Text>
            </View>
          )}
          
          {faqError && (
            <Text style={styles.faqError}>{faqError}</Text>
          )}
          
          {!faqLoading && !faqError && (
            <>
              {filteredFaqs.length === 0 && (
                <Text style={styles.noFaqsText}>{t('helpSupport.noFaqsFound')}</Text>
              )}
              {filteredFaqs.map(faq => (
                <View key={faq.id} style={styles.faqItem}>
                  <TouchableOpacity
                    style={styles.faqQuestion}
                    onPress={() => setOpenFaqId(openFaqId === faq.id ? null : faq.id)}
                  >
                    <Text style={styles.faqQuestionText}>{faq.question}</Text>
                    <Ionicons 
                      name={openFaqId === faq.id ? "chevron-up" : "chevron-down"} 
                      size={16} 
                      color="#999" 
                    />
                  </TouchableOpacity>
                  {openFaqId === faq.id && (
                    <View style={styles.faqAnswer}>
                      {faq.img && (
                        <Image
                        source={{ uri: `https://wanslu.shop/faqs/${encodeURIComponent(faq.img)}` }}
                        style={styles.faqImage}
                          resizeMode="contain"
                        />
                      )}
                      <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                    </View>
                  )}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {screen === 'main' && renderMainScreen()}
      {screen === 'faq' && renderFaqScreen()}
      
      {/* Chat Modal */}
      <Modal
        visible={screen === 'chat'}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ChatWidget onClose={() => setScreen('main')} initialMessage={message} />
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  customHeader: {
    backgroundColor: '#E53E3E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSpacer: {
    width: 24,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
  heroSection: {
    backgroundColor: 'blue',
    
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 60,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  heroHeader: {
    paddingTop: 50,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  heroLogo: {
    width: 28,
    height: 28,
    backgroundColor: '#fff',
    borderRadius: 100,
  },  
  heroBg: {
    borderRadius: 100,
    padding: 10,
    backgroundColor: '#fff',
    marginRight: 10
  },
  heroTitle: {
    fontSize: 25,
    fontWeight: '600',
    color: '#fff',
  },
  heroGreeting: {
    fontSize: 20,
    color: '#fff',
    opacity: 0.8,
    marginBottom: 8,
  },
  heroQuestion: {
    fontSize: 35,
    fontWeight: 'bold',
    color: '#fff',
  },
  optionsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  optionButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  optionTitleDisabled: {
    color: '#999',
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  optionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 20,
  },
  faqPreview: {
    flex: 1,
  },
  faqPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  faqPreviewQuestion: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  seeAllButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 10,
  },
  seeAllText: {
    color: '#E53E3E',
    fontSize: 16,
    fontWeight: '600',
  },
  faqLoading: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  faqLoadingText: {
    marginTop: 8,
    color: '#666',
  },
  faqError: {
    textAlign: 'center',
    color: '#E53E3E',
    paddingVertical: 20,
  },
  faqHeader: {
    backgroundColor: '#E53E3E',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    marginRight: 16,
  },
  faqHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  searchInput: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  faqList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  faqItem: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  faqQuestionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  faqImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  faqAnswerText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  noFaqsText: {
    textAlign: 'center',
    color: '#666',
    paddingVertical: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  chatHeader: {
    backgroundColor: '#E53E3E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 40,
  },
  chatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatLogo: {
    width: 32,
    height: 32,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginRight: 12,
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  chatStatus: {
    fontSize: 12,
    color: '#90EE90',
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  welcomeContainer: {
    padding: 20,
    backgroundColor: '#f8f8f8',
  },
  welcomeCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  welcomeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageContainer: {
    marginBottom: 12,
  },
  messageUser: {
    alignItems: 'flex-end',
  },
  messageAdmin: {
    alignItems: 'flex-start',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    maxWidth: '85%',
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  messageBubbleUser: {
    backgroundColor: '#E53E3E',
  },
  messageBubbleAdmin: {
    backgroundColor: '#f0f0f0',
  },
  messageText: {
    fontSize: 14,
  },
  translateButton: {
    marginLeft: 6,
    padding: 6,
    alignSelf: 'center',
  },
  messageTextUser: {
    color: '#fff',
  },
  messageTextAdmin: {
    color: '#333',
  },
  messageTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    marginHorizontal: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: '#E53E3E',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
});
