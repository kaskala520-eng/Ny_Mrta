import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, CheckCheck, MessageCircle } from 'lucide-react';
import { ChatMessage, User } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import { CONTACT_MESSAGES_STORAGE_KEY } from '../../utils/adminTracking';

interface WhatsAppChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
}

export const CONTACT_UPDATED_EVENT = 'metany:contact-updated';

function buildDefaultMessages(isRTL: boolean): ChatMessage[] {
  return [
    {
      id: 'contact_welcome_1',
      senderId: 'support_team',
      senderName: isRTL ? 'فريق تواصل Meta.Ny' : 'Meta.Ny Contact Desk',
      senderRole: 'admin',
      recipientId: 'local_user',
      content: isRTL
        ? 'مرحباً بك! يمكنك إرسال استفسارك أو ملاحظاتك أو طلب التفعيل هنا مباشرة، وستصل رسالتك لإدارة المنصة فوراً دون الحاجة لبريد إلكتروني.'
        : 'Welcome! Send your inquiry, feedback, or support request directly here with no email required.',
      timestamp: new Date().toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      read: true,
    },
  ];
}

export const WhatsAppChatModal: React.FC<WhatsAppChatModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const { isRTL } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(() => {
    try {
      const raw = localStorage.getItem(CONTACT_MESSAGES_STORAGE_KEY);
      if (raw) {
        const parsed: ChatMessage[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const activeId = currentUser?.id || 'local_user';
          const visible = currentUser?.isAdmin
            ? parsed
            : parsed.filter(
                (m) =>
                  m.senderId === activeId ||
                  m.recipientId === activeId ||
                  m.recipientId === 'all' ||
                  m.recipientId === 'local_user'
              );
          setMessages(visible.length > 0 ? visible : buildDefaultMessages(isRTL));
          return;
        }
      }
    } catch {
      // Fallback to default message
    }
    setMessages(buildDefaultMessages(isRTL));
  }, [isRTL, currentUser]);

  useEffect(() => {
    if (!isOpen) return;
    loadMessages();

    const handleSync = () => loadMessages();
    window.addEventListener(CONTACT_UPDATED_EVENT, handleSync);
    return () => window.removeEventListener(CONTACT_UPDATED_EVENT, handleSync);
  }, [isOpen, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const textToSend = inputText.trim();
    if (!textToSend) return;

    setSending(true);
    setInputText('');

    const nowTime = new Date().toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      senderId: currentUser?.id || 'local_user',
      senderName: currentUser?.name || (isRTL ? 'أنت' : 'You'),
      senderRole: 'user',
      recipientId: 'support_team',
      content: textToSend,
      timestamp: nowTime,
      read: false,
    };

    const updated = [...messages, userMsg].slice(-60);
    setMessages(updated);
    try {
      localStorage.setItem(CONTACT_MESSAGES_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event(CONTACT_UPDATED_EVENT));
    } catch {
      // Ignore storage quota
    }
    setSending(false);
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div
        className={`bg-[#efeae2] dark:bg-[#0b141a] rounded-3xl w-full max-w-lg h-[600px] max-h-[92vh] flex flex-col shadow-2xl border border-slate-300 dark:border-slate-800 overflow-hidden ${
          isRTL ? 'text-right' : 'text-left'
        } transition-colors`}
      >
        {/* Header */}
        <div className="bg-[#075e54] dark:bg-[#1f2c34] text-white px-4 py-3 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-700 border-2 border-emerald-400 flex items-center justify-center text-white shrink-0">
              <MessageCircle className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <span>{isRTL ? 'تواصل معنا · Meta.Ny' : 'Contact Us · Meta.Ny'}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </h3>
              <p className="text-[11px] text-emerald-200">
                {isRTL
                  ? 'أرسل استفسارك أو طلبك مباشرة بدون بريد إلكتروني'
                  : 'Send your inquiry or request directly with no email exposed'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
          {messages.map((msg) => {
            const isMe = msg.senderRole === 'user';
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm shadow-xs ${
                    isMe
                      ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-slate-100 rounded-br-xs'
                      : 'bg-white dark:bg-[#202c33] text-slate-900 dark:text-slate-100 rounded-bl-xs'
                  }`}
                >
                  <div className="text-[10px] font-bold text-slate-500 dark:text-emerald-300 mb-0.5">
                    {msg.senderRole === 'admin'
                      ? isRTL
                        ? 'فريق الدعم والتواصل'
                        : 'Support Team'
                      : msg.senderName}
                  </div>
                  <p className="leading-relaxed whitespace-pre-line">{msg.content}</p>
                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-400 dark:text-slate-300/80">
                    <span>{msg.timestamp}</span>
                    <CheckCheck className="w-3.5 h-3.5 text-blue-500 dark:text-sky-300" />
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSend}
          className="p-3 bg-white dark:bg-[#1f2c34] border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isRTL ? 'اكتب رسالتك أو استفسارك هنا...' : 'Write your message or inquiry here...'
            }
            className={`flex-1 bg-slate-100 dark:bg-[#2a3942] border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-400 focus:outline-hidden focus:bg-white dark:focus:bg-[#2a3942] focus:border-emerald-500 ${
              isRTL ? 'text-right' : 'text-left'
            }`}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="w-10 h-10 rounded-full bg-[#075e54] hover:bg-[#128c7e] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white flex items-center justify-center shadow-md transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Send className={`w-4 h-4 ${isRTL ? 'transform rotate-180' : ''}`} />
          </button>
        </form>
      </div>
    </div>
  );
};
