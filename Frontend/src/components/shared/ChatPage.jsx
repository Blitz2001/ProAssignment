import React, { useState, useEffect, useRef } from 'react';
import SendIcon from '../icons/SendIcon';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useAssignmentUnread } from '../../context/AssignmentUnreadContext';
import { getConversations, getChatMessages, postChatMessage, markMessagesAsRead } from '../../services/api';
import { validateNoContactInfo } from '../../utils/contactValidation';
import Avatar from './Avatar';

// Helper to format date
const formatMessageDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
    }
};

// Helper to check if messages are from same sender and within 5 minutes
const shouldGroupMessages = (currentMsg, prevMsg) => {
    if (!prevMsg) return false;
    if (currentMsg.senderId?.toString() !== prevMsg.senderId?.toString()) return false;
    
    const currentTime = new Date(currentMsg.timestamp).getTime();
    const prevTime = new Date(prevMsg.timestamp).getTime();
    const diffMinutes = (currentTime - prevTime) / (1000 * 60);
    
    return diffMinutes < 5;
};

// Helper to format time - only show hours and minutes, no seconds
const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ChatBubble = ({ message, isOwn, senderName, senderRole, showAvatar, showDate, isGrouped }) => {
    // Get role badge color
    const getRoleBadge = (role) => {
        if (!role || role === 'user') return null;
        const roleColors = {
            'admin': 'bg-indigo-500 text-white',
            'writer': 'bg-purple-500 text-white',
        };
        const roleLabels = {
            'admin': 'ADMIN',
            'writer': 'WRITER',
        };
        return (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${roleColors[role] || 'bg-gray-500 text-white'}`}>
                {roleLabels[role] || role.toUpperCase()}
            </span>
        );
    };

    const timeString = message.timestamp 
        ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';

    return (
        <>
            {showDate && (
                <div className="flex items-center justify-center my-2">
                    <div className="bg-gray-200 text-gray-600 text-xs font-medium px-3 py-0.5 rounded-full">
                        {formatMessageDate(message.timestamp)}
                    </div>
                </div>
            )}
            <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mb-0.5' : 'mb-2'}`}>
                <div className={`flex ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end max-w-[85%] md:max-w-[78%] gap-2`}>
                    {!isOwn && showAvatar && (
                        <Avatar user={{ name: senderName || 'User' }} className="w-7 h-7 flex-shrink-0" />
                    )}
                    {!isOwn && !showAvatar && (
                        <div className="w-7 flex-shrink-0" />
                    )}
                    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} min-w-0 flex-1`}>
                        {!isOwn && showAvatar && (
                            <div className="flex items-center gap-1.5 mb-0.5 px-1">
                                <span className="text-xs text-gray-600 font-medium">{senderName || 'User'}</span>
                                {senderRole && senderRole !== 'user' && getRoleBadge(senderRole)}
                            </div>
                        )}
                        <div className={`rounded-lg px-3 py-1.5 max-w-full ${
                            isOwn 
                                ? 'bg-indigo-600 text-white' 
                                : 'bg-gray-100 text-gray-900'
                        } ${isGrouped && !isOwn ? 'rounded-tl-sm' : ''} ${isGrouped && isOwn ? 'rounded-tr-sm' : ''}`}>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.text || message.message || ''}</p>
                        </div>
                        {!isGrouped && (
                            <span className={`text-[10px] text-gray-400 mt-0.5 px-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                                {timeString}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

// Single Chat Box Component for Client View
const ClientChatBox = ({ conversation, messages, loading, newMessage, setNewMessage, errorMessage, onSendMessage, chatBodyRef, user, chatType, onRefreshConversations }) => {
    const isAdminChatType = chatType === 'admin';
    const showInput = isAdminChatType || conversation; // Always show input for admin chat, only show for writer if conversation exists
    
    if (!conversation) {
        return (
            <div className="flex-1 flex flex-col bg-white border-2 border-dashed border-gray-300 rounded-lg shadow-sm">
                <div className={`p-4 border-b-2 ${isAdminChatType ? 'bg-gradient-to-r from-indigo-50 to-indigo-100 border-indigo-300' : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200'}`}>
                    <div className="flex items-center gap-2">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isAdminChatType ? 'bg-indigo-500' : 'bg-purple-500'}`}>
                            {isAdminChatType ? (
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">
                                {isAdminChatType ? 'Admin Support Chat' : 'Writer Chat'}
                            </h3>
                            {isAdminChatType && (
                                <span className="bg-indigo-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm mt-1 inline-block">
                                    ADMIN
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-6 min-h-0">
                    {isAdminChatType ? (
                        <div className="text-center max-w-md">
                            <div className="mb-4">
                                <svg className="w-16 h-16 mx-auto text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <p className="text-gray-600 font-medium mb-2">Admin Support Chat</p>
                            <p className="text-gray-500 text-sm">You can message admin anytime for support and questions.</p>
                            <p className="text-gray-400 text-xs mt-2">Start typing below to begin the conversation!</p>
                        </div>
                    ) : (
                        <div className="text-center max-w-md">
                            <div className="mb-4">
                                <svg className="w-16 h-16 mx-auto text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <p className="text-gray-600 font-medium mb-2">Writer Chat</p>
                            <p className="text-gray-500 text-sm">Chat with your assigned writer will appear here once a writer is assigned to your assignment.</p>
                        </div>
                    )}
                </div>
                {/* Input Area - Always show for admin chat */}
                {showInput && (
                    <div className={`p-4 border-t-2 ${isAdminChatType ? 'bg-white border-indigo-300' : 'bg-white border-gray-300'}`}>
                        {errorMessage && (
                            <div className="mb-3 p-3 bg-red-50 border-l-4 border-red-500 rounded shadow-sm">
                                <p className="text-sm font-medium text-red-800">{errorMessage}</p>
                            </div>
                        )}
                        <form onSubmit={onSendMessage} className="flex items-center space-x-3">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    placeholder={isAdminChatType ? "Type your message to admin..." : "Type your message to writer..."}
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                    className={`w-full px-4 py-3 border-2 rounded-full focus:outline-none focus:ring-2 transition-all ${
                                        isAdminChatType 
                                            ? 'border-indigo-300 focus:ring-indigo-500 focus:border-indigo-500' 
                                            : 'border-gray-300 focus:ring-purple-500 focus:border-purple-500'
                                    }`}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={!newMessage.trim()}
                                className={`rounded-full p-3 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg ${
                                    isAdminChatType
                                        ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 text-white'
                                        : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500 text-white'
                                }`}
                            >
                                <SendIcon className="w-5 h-5" />
                            </button>
                        </form>
                    </div>
                )}
            </div>
        );
    }

    const isAdminChat = conversation.isSupportChat;
    const chatTitle = isAdminChat ? 'Admin Support' : 'Writer Chat';
    const chatSubtitle = isAdminChat ? 'Message admin anytime for support' : (conversation.writerName ? `Chatting with ${conversation.writerName}` : 'Chat with your assigned writer');

    return (
        <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            {/* Header */}
            <div className={`p-3 border-b ${isAdminChat ? 'bg-indigo-50 border-indigo-200' : 'bg-purple-50 border-purple-200'} flex items-center`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 flex-shrink-0 ${isAdminChat ? 'bg-indigo-500' : 'bg-purple-500'}`}>
                    {isAdminChat ? (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-semibold text-gray-800">{chatTitle}</h3>
                        {isAdminChat && (
                            <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                                ADMIN
                            </span>
                        )}
                        {conversation.isAssignmentChat && (
                            <span className="bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                                WRITER
                            </span>
                        )}
                    </div>
                    <p className={`text-xs font-normal mt-0.5 truncate ${isAdminChat ? 'text-indigo-600' : 'text-purple-600'}`}>
                        {chatSubtitle}
                    </p>
                </div>
            </div>

            {/* Messages */}
            <div 
                ref={chatBodyRef} 
                className="flex-1 p-3 md:p-4 overflow-y-auto bg-white"
                style={{ 
                    scrollBehavior: 'smooth',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#e5e7eb #ffffff',
                    minHeight: '200px'
                }}
            >
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="flex flex-col items-center gap-2">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            <div className="text-gray-500 text-sm">Loading messages...</div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {messages && Array.isArray(messages) && messages.length > 0 ? (
                            messages
                                .filter(msg => {
                                    const text = (msg.text || msg.message || '').trim();
                                    if (!text) {
                                        console.warn('Chat: Filtering out message with no text', msg);
                                        return false;
                                    }
                                    return true;
                                })
                                .map((msg, idx) => {
                                    const messageText = (msg.text || msg.message || '').trim();
                                    const isOwn = msg.isOwnMessage !== undefined 
                                        ? msg.isOwnMessage 
                                        : (msg.senderId?.toString() === user?.id?.toString() || msg.senderId === user?.id);
                                    const prevMessage = idx > 0 ? messages[idx - 1] : null;
                                    const showAvatar = !isOwn && (!prevMessage || prevMessage.senderId?.toString() !== msg.senderId?.toString());
                                    const isGrouped = shouldGroupMessages(msg, prevMessage);
                                    const showDate = !prevMessage || 
                                        formatMessageDate(msg.timestamp) !== formatMessageDate(prevMessage.timestamp);
                                    const messageTimestamp = msg.timestamp || msg.createdAt || new Date();
                                    
                                    return (
                                        <ChatBubble 
                                            key={msg.id || msg._id || `msg-${idx}`} 
                                            message={{
                                                text: messageText,
                                                message: messageText,
                                                timestamp: messageTimestamp,
                                                createdAt: messageTimestamp
                                            }}
                                            isOwn={isOwn}
                                            senderName={msg.senderName || msg.sender?.name || 'User'}
                                            senderRole={msg.senderRole || msg.sender?.role || 'user'}
                                            showAvatar={showAvatar}
                                            showDate={showDate}
                                            isGrouped={isGrouped}
                                        />
                                    );
                                })
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-gray-400 text-sm">No messages yet. Start the conversation!</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className={`p-4 border-t-2 ${isAdminChat ? 'bg-white border-indigo-300' : 'bg-white border-purple-300'}`}>
                {errorMessage && (
                    <div className="mb-3 p-3 bg-red-50 border-l-4 border-red-500 rounded shadow-sm">
                        <p className="text-sm font-medium text-red-800">{errorMessage}</p>
                    </div>
                )}
                <form onSubmit={onSendMessage} className="flex items-center space-x-3">
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            placeholder={isAdminChat ? "Type your message to admin..." : "Type your message to writer..."}
                            value={newMessage}
                            onChange={e => setNewMessage(e.target.value)}
                            className={`w-full px-4 py-3 border-2 rounded-full focus:outline-none focus:ring-2 transition-all ${
                                isAdminChat 
                                    ? 'border-indigo-300 focus:ring-indigo-500 focus:border-indigo-500' 
                                    : 'border-purple-300 focus:ring-purple-500 focus:border-purple-500'
                            }`}
                            disabled={!conversation}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || !conversation}
                        className={`rounded-full p-3 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg ${
                            isAdminChat
                                ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 text-white'
                                : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500 text-white'
                        }`}
                    >
                        <SendIcon className="w-5 h-5" />
                    </button>
                </form>
            </div>
        </div>
    );
};

const ChatPage = () => {
    const { user } = useAuth();
    const socket = useSocket();
    const [conversations, setConversations] = useState([]);
    
    // For client view: separate state for admin and writer chats
    const [adminChat, setAdminChat] = useState(null);
    const [writerChat, setWriterChat] = useState(null);
    const [adminMessages, setAdminMessages] = useState([]);
    const [writerMessages, setWriterMessages] = useState([]);
    const [adminNewMessage, setAdminNewMessage] = useState('');
    const [writerNewMessage, setWriterNewMessage] = useState('');
    const [adminErrorMessage, setAdminErrorMessage] = useState(null);
    const [writerErrorMessage, setWriterErrorMessage] = useState(null);
    const adminChatBodyRef = useRef(null);
    const writerChatBodyRef = useRef(null);
    
    // For client three-panel view: active chat state
    const [clientActiveChatId, setClientActiveChatId] = useState(null);
    const [clientActiveMessages, setClientActiveMessages] = useState([]);
    const [clientActiveNewMessage, setClientActiveNewMessage] = useState('');
    const [clientActiveErrorMessage, setClientActiveErrorMessage] = useState(null);
    const clientActiveChatBodyRef = useRef(null);
    const [clientActiveChatLoading, setClientActiveChatLoading] = useState(false);
    const [clientActiveContactWarning, setClientActiveContactWarning] = useState(null);
    
    // Assignment unread context
    const { updateUnreadCount } = useAssignmentUnread();
    
    // For non-client view: original single chat state
    const [messages, setMessages] = useState([]);
    const [activeChatId, setActiveChatId] = useState(null);
    const [newMessage, setNewMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState(null);
    const chatBodyRef = useRef(null);
    const [contactWarning, setContactWarning] = useState(null);
    
    // Helper function to format conversations (moved up for use in useEffect)
    const formatConversations = (conversationsData) => {
        return conversationsData.map(convo => ({
            id: convo.id || convo._id,
            name: convo.name || 'Unknown',
            avatar: convo.avatar || null,
            lastMessage: convo.lastMessage || 'Start a conversation!',
            lastMessageSender: convo.lastMessageSender || null,
            lastMessageSenderRole: convo.lastMessageSenderRole || null,
            isLastMessageFromOther: convo.isLastMessageFromOther !== undefined ? convo.isLastMessageFromOther : false,
            timestamp: convo.timestamp || '',
            lastMessageTime: convo.lastMessageTime || null,
            unread: convo.unread || 0,
            unreadCount: convo.unreadCount || convo.unread || 0,
            participants: Array.isArray(convo.participants) ? convo.participants.map(p => ({
                id: p.id || p._id || p,
                name: p.name || 'Unknown',
                role: p.role || 'user',
                avatar: p.avatar || null
            })) : [],
            assignmentId: convo.assignmentId || null,
            assignmentTitle: convo.assignmentTitle || null,
            isSupportChat: convo.isSupportChat !== undefined ? convo.isSupportChat : !convo.assignmentId,
            isAssignmentChat: convo.isAssignmentChat !== undefined ? convo.isAssignmentChat : !!convo.assignmentId,
            clientName: convo.clientName || null,
            writerName: convo.writerName || null,
            adminName: convo.adminName || null,
            isOnline: convo.isOnline || false,
        }));
    };

    const [loading, setLoading] = useState({ convos: true, adminMessages: false, writerMessages: false, messages: false });

    // Load conversations
    useEffect(() => {
        if (!user) return;
        setLoading(prev => ({ ...prev, convos: true }));
        getConversations().then(res => {
            const conversationsData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            console.log('Chat: Loaded conversations for user', user?.role, '- Count:', conversationsData.length);
            
            const formattedConversations = formatConversations(conversationsData);
            console.log('Chat: Formatted conversations:', formattedConversations.map(c => ({ 
                id: c.id, 
                name: c.name, 
                isSupport: c.isSupportChat, 
                isAssignment: c.isAssignmentChat 
            })));
            
            setConversations(formattedConversations);
            
            // For clients: separate admin and writer chats
            if (user?.role === 'user') {
                const adminConvo = formattedConversations.find(c => c.isSupportChat);
                const writerConvo = formattedConversations.find(c => c.isAssignmentChat);
                setAdminChat(adminConvo || null);
                setWriterChat(writerConvo || null);
                console.log('Chat: Client view - Admin chat:', adminConvo?.id, 'Writer chat:', writerConvo?.id);
                
                // If admin chat doesn't exist, it should be created by backend, so reload after a short delay
                if (!adminConvo) {
                    console.log('Chat: ⚠️ Admin chat not found in initial load, will retry...');
                    setTimeout(() => {
                        getConversations().then(res => {
                            const retryData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
                            const retryFormatted = formatConversations(retryData);
                            const retryAdminConvo = retryFormatted.find(c => c.isSupportChat);
                            if (retryAdminConvo) {
                                console.log('Chat: ✅ Found admin chat on retry:', retryAdminConvo.id);
                                setAdminChat(retryAdminConvo);
                                setConversations(retryFormatted);
                            } else {
                                console.error('Chat: ❌ Admin chat still not found after retry');
                                console.error('Chat: This may indicate no admin user exists in the database');
                            }
                        }).catch(err => {
                            console.error('Chat: Retry error', err);
                        });
                    }, 3000); // Wait 3 seconds for backend to create it
                }
            } else {
                // For non-clients: use original single chat view
                if (formattedConversations.length > 0 && !activeChatId) {
                    setActiveChatId(formattedConversations[0].id);
                }
            }
        }).catch(err => {
            console.error('Chat: ❌ Error loading conversations', err);
            console.error('Chat: Error details:', err.response?.data || err.message);
            setConversations([]);
            if (user?.role === 'user') {
                setAdminErrorMessage('Failed to load conversations. Please refresh the page.');
                setTimeout(() => setAdminErrorMessage(null), 10000);
            }
        }).finally(() => setLoading(prev => ({ ...prev, convos: false })));
    }, [user]);

    // Update adminChat and writerChat when conversations change (for clients)
    useEffect(() => {
        if (user?.role === 'user' && conversations.length > 0) {
            const adminConvo = conversations.find(c => c.isSupportChat);
            const writerConvo = conversations.find(c => c.isAssignmentChat);
            
            // Only update if they changed to avoid unnecessary re-renders
            if (adminConvo && (!adminChat || adminChat.id !== adminConvo.id)) {
                setAdminChat(adminConvo);
            } else if (!adminConvo && adminChat) {
                setAdminChat(null);
            }
            
            if (writerConvo && (!writerChat || writerChat.id !== writerConvo.id)) {
                setWriterChat(writerConvo);
            } else if (!writerConvo && writerChat) {
                setWriterChat(null);
            }
        }
    }, [conversations, user, adminChat, writerChat]);

    // Load messages for admin chat (client view)
    useEffect(() => {
        if (user?.role !== 'user') return;
        
        // If admin chat doesn't exist, try to load it
        if (!adminChat) {
            getConversations().then(res => {
                const conversationsData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
                const formattedConversations = formatConversations(conversationsData);
                const adminConvo = formattedConversations.find(c => c.isSupportChat);
                if (adminConvo) {
                    console.log('Chat: Found admin chat, loading messages:', adminConvo.id);
                    setAdminChat(adminConvo);
                } else {
                    console.log('Chat: Admin chat not found yet, will retry when sending message');
                }
            }).catch(err => console.error('Chat: Error loading conversations for admin chat', err));
            return;
        }
        
        // Load messages for the admin chat
        setLoading(prev => ({ ...prev, adminMessages: true }));
        console.log('Chat: Loading messages for admin chat:', adminChat.id);
        getChatMessages(adminChat.id).then(async (res) => {
            // Mark messages as read immediately when chat is opened
            const assignmentId = adminChat.assignmentId;
            
            // Update conversation unread count immediately (optimistic update)
            setConversations(prev => prev.map(c => {
                if (c.id === adminChat.id || String(c.id) === String(adminChat.id)) {
                    return { ...c, unread: 0, unreadCount: 0 };
                }
                return c;
            }));
            
            // Update context immediately (optimistic update)
            if (assignmentId) {
                console.log('Chat: Immediately updating unread count to 0 for admin chat assignment:', assignmentId);
                updateUnreadCount(assignmentId, 0);
            }
            
            try {
                await markMessagesAsRead(adminChat.id);
                console.log('Chat: ✅ Marked admin messages as read');
                
                // Update conversation unread count again after API call
                setConversations(prev => prev.map(c => {
                    if (c.id === adminChat.id || String(c.id) === String(adminChat.id)) {
                        return { ...c, unread: 0, unreadCount: 0 };
                    }
                    return c;
                }));
                
                // Update context again after API call
                if (assignmentId) {
                    updateUnreadCount(assignmentId, 0);
                    window.dispatchEvent(new CustomEvent('assignmentUnreadUpdated', { 
                        detail: { assignmentId: assignmentId, unreadCount: 0 } 
                    }));
                    localStorage.setItem(`assignmentUnread_${assignmentId}`, '0');
                }
            } catch (error) {
                console.error('Chat: Error marking admin messages as read:', error);
                // Keep optimistic update even if API fails
                setConversations(prev => prev.map(c => {
                    if (c.id === adminChat.id || String(c.id) === String(adminChat.id)) {
                        return { ...c, unread: 0, unreadCount: 0 };
                    }
                    return c;
                }));
                if (assignmentId) {
                    updateUnreadCount(assignmentId, 0);
                    window.dispatchEvent(new CustomEvent('assignmentUnreadUpdated', { 
                        detail: { assignmentId: assignmentId, unreadCount: 0 } 
                    }));
                }
            }
            const messagesData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            console.log('Chat: ✅ Loaded', messagesData.length, 'admin messages');
            const formattedMessages = messagesData
                .filter(msg => {
                    const text = (msg.text || msg.message || '').trim();
                    if (!text) return false;
                    return true;
                })
                .map(msg => {
                    const text = msg.text || msg.message || '';
                    const senderId = msg.senderId || msg.sender?._id || msg.sender?.id;
                    return {
                        ...msg,
                        id: msg.id || msg._id,
                        _id: msg._id || msg.id,
                        chatId: msg.chatId || msg.conversation || adminChat.id,
                        conversation: msg.conversation || msg.chatId || adminChat.id,
                        senderId: senderId,
                        senderName: msg.senderName || msg.sender?.name || 'Unknown',
                        senderRole: msg.senderRole || msg.sender?.role || 'user',
                        text: text,
                        message: text,
                        timestamp: msg.timestamp || msg.createdAt || new Date(),
                        createdAt: msg.createdAt || msg.timestamp || new Date(),
                        isOwnMessage: msg.isOwnMessage !== undefined 
                            ? msg.isOwnMessage 
                            : (senderId?.toString() === user?.id?.toString() || senderId === user?.id),
                        sender: msg.sender || {
                            _id: senderId,
                            name: msg.senderName || msg.sender?.name || 'Unknown',
                            role: msg.senderRole || msg.sender?.role || 'user'
                        }
                    };
                });
            setAdminMessages(formattedMessages);
        }).catch(err => {
            console.error('Chat: ❌ Error loading admin messages', err);
            setAdminMessages([]);
        }).finally(() => setLoading(prev => ({ ...prev, adminMessages: false })));
    }, [adminChat, user]);

    // Load messages for writer chat (client view)
    useEffect(() => {
        if (!writerChat || user?.role !== 'user') return;
        setLoading(prev => ({ ...prev, writerMessages: true }));
        getChatMessages(writerChat.id).then(async (res) => {
            // Mark messages as read immediately when chat is opened
            const assignmentId = writerChat.assignmentId;
            
            // Update conversation unread count immediately (optimistic update)
            setConversations(prev => prev.map(c => {
                if (c.id === writerChat.id || String(c.id) === String(writerChat.id)) {
                    return { ...c, unread: 0, unreadCount: 0 };
                }
                return c;
            }));
            
            // Update context immediately (optimistic update)
            if (assignmentId) {
                console.log('Chat: Immediately updating unread count to 0 for writer chat assignment:', assignmentId);
                updateUnreadCount(assignmentId, 0);
            }
            
            try {
                console.log('Chat: Marking writer messages as read for conversation:', writerChat.id);
                await markMessagesAsRead(writerChat.id);
                console.log('Chat: ✅ Marked writer messages as read, badge should disappear now');
                
                // Update conversation unread count again after API call
                setConversations(prev => prev.map(c => {
                    if (c.id === writerChat.id || String(c.id) === String(writerChat.id)) {
                        return { ...c, unread: 0, unreadCount: 0 };
                    }
                    return c;
                }));
                
                // Update context again after API call
                if (assignmentId) {
                    updateUnreadCount(assignmentId, 0);
                    window.dispatchEvent(new CustomEvent('assignmentUnreadUpdated', { 
                        detail: { assignmentId: assignmentId, unreadCount: 0 } 
                    }));
                    localStorage.setItem(`assignmentUnread_${assignmentId}`, '0');
                }
            } catch (error) {
                console.error('Chat: Error marking writer messages as read:', error);
                // Keep optimistic update even if API fails
                setConversations(prev => prev.map(c => {
                    if (c.id === writerChat.id || String(c.id) === String(writerChat.id)) {
                        return { ...c, unread: 0, unreadCount: 0 };
                    }
                    return c;
                }));
                if (assignmentId) {
                    updateUnreadCount(assignmentId, 0);
                    window.dispatchEvent(new CustomEvent('assignmentUnreadUpdated', { 
                        detail: { assignmentId: assignmentId, unreadCount: 0 } 
                    }));
                }
            }
            const messagesData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            const formattedMessages = messagesData
                .filter(msg => (msg.text || msg.message || '').trim() !== '')
                .map(msg => {
                    const text = msg.text || msg.message || '';
                    const senderId = msg.senderId || msg.sender?._id || msg.sender?.id;
                    return {
                        ...msg,
                        id: msg.id || msg._id,
                        _id: msg._id || msg.id,
                        chatId: msg.chatId || msg.conversation || writerChat.id,
                        conversation: msg.conversation || msg.chatId || writerChat.id,
                        senderId: senderId,
                        senderName: msg.senderName || msg.sender?.name || 'Unknown',
                        senderRole: msg.senderRole || msg.sender?.role || 'user',
                        text: text,
                        message: text,
                        timestamp: msg.timestamp || msg.createdAt || new Date(),
                        createdAt: msg.createdAt || msg.timestamp || new Date(),
                        isOwnMessage: msg.isOwnMessage !== undefined 
                            ? msg.isOwnMessage 
                            : (senderId?.toString() === user?.id?.toString() || senderId === user?.id),
                        sender: msg.sender || {
                            _id: senderId,
                            name: msg.senderName || msg.sender?.name || 'Unknown',
                            role: msg.senderRole || msg.sender?.role || 'user'
                        }
                    };
                });
            setWriterMessages(formattedMessages);
        }).catch(err => {
            console.error('Chat: Error loading writer messages', err);
            setWriterMessages([]);
        }).finally(() => setLoading(prev => ({ ...prev, writerMessages: false })));
    }, [writerChat, user]);

    // Load messages for single chat view (non-client)
    useEffect(() => {
        if (!activeChatId || user?.role === 'user') {
            setMessages([]);
            return;
        }
        setLoading(prev => ({ ...prev, messages: true }));
        getChatMessages(activeChatId).then(async (res) => {
            // Note: getMessages already marks as read, but we'll also call markMessagesAsRead for extra assurance
            // Find conversation and get assignmentId FIRST (before async call)
            const activeConvo = conversations.find(c => c.id === activeChatId || String(c.id) === String(activeChatId));
            const assignmentId = activeConvo?.assignmentId;
            
            // Update conversation unread count immediately (optimistic update)
            setConversations(prev => prev.map(c => {
                if (c.id === activeChatId || String(c.id) === String(activeChatId)) {
                    return { ...c, unread: 0, unreadCount: 0 };
                }
                return c;
            }));
            
            // Update context immediately (optimistic update)
            if (assignmentId) {
                console.log('Chat: Immediately updating unread count to 0 for assignment:', assignmentId);
                updateUnreadCount(assignmentId, 0);
            }
            
            // Mark messages as read immediately when chat is opened
            try {
                console.log('Chat: Marking messages as read for conversation:', activeChatId, 'assignmentId:', assignmentId);
                await markMessagesAsRead(activeChatId);
                console.log('Chat: ✅ Marked messages as read, badge should disappear now');
                
                // Update conversation unread count again after API call
                setConversations(prev => prev.map(c => {
                    if (c.id === activeChatId || String(c.id) === String(activeChatId)) {
                        return { ...c, unread: 0, unreadCount: 0 };
                    }
                    return c;
                }));
                
                // Update context again after API call (to ensure consistency)
                if (assignmentId) {
                    updateUnreadCount(assignmentId, 0);
                    // Dispatch window event for other components
                    window.dispatchEvent(new CustomEvent('assignmentUnreadUpdated', { 
                        detail: { assignmentId: assignmentId, unreadCount: 0 } 
                    }));
                    // Also use localStorage as a fallback
                    localStorage.setItem(`assignmentUnread_${assignmentId}`, '0');
                    localStorage.setItem('lastAssignmentUnreadUpdate', JSON.stringify({ 
                        assignmentId, 
                        unreadCount: 0, 
                        timestamp: Date.now() 
                    }));
                }
            } catch (error) {
                console.error('Chat: Error marking messages as read:', error);
                // Even if API call fails, keep the optimistic update
                setConversations(prev => prev.map(c => {
                    if (c.id === activeChatId || String(c.id) === String(activeChatId)) {
                        return { ...c, unread: 0, unreadCount: 0 };
                    }
                    return c;
                }));
                if (assignmentId) {
                    updateUnreadCount(assignmentId, 0);
                    window.dispatchEvent(new CustomEvent('assignmentUnreadUpdated', { 
                        detail: { assignmentId: assignmentId, unreadCount: 0 } 
                    }));
                }
            }
            const messagesData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            const formattedMessages = messagesData
                .filter(msg => (msg.text || msg.message || '').trim() !== '')
                .map(msg => {
                    const text = msg.text || msg.message || '';
                    const senderId = msg.senderId || msg.sender?._id || msg.sender?.id;
                    return {
                        ...msg,
                        id: msg.id || msg._id,
                        _id: msg._id || msg.id,
                        chatId: msg.chatId || msg.conversation || activeChatId,
                        conversation: msg.conversation || msg.chatId || activeChatId,
                        senderId: senderId,
                        senderName: msg.senderName || msg.sender?.name || 'Unknown',
                        senderRole: msg.senderRole || msg.sender?.role || 'user',
                        text: text,
                        message: text,
                        timestamp: msg.timestamp || msg.createdAt || new Date(),
                        createdAt: msg.createdAt || msg.timestamp || new Date(),
                        isOwnMessage: msg.isOwnMessage !== undefined 
                            ? msg.isOwnMessage 
                            : (senderId?.toString() === user?.id?.toString() || senderId === user?.id),
                        sender: msg.sender || {
                            _id: senderId,
                            name: msg.senderName || msg.sender?.name || 'Unknown',
                            role: msg.senderRole || msg.sender?.role || 'user'
                        }
                    };
                });
            setMessages(formattedMessages);
        }).catch(err => {
            console.error('Chat: Error loading messages', err);
            setMessages([]);
        }).finally(() => setLoading(prev => ({ ...prev, messages: false })));
    }, [activeChatId, user]);

    // Real-time socket listeners
    useEffect(() => {
        if (!socket) return;

        const handleReceiveMessage = (message) => {
            const messageChatId = message.chatId?.toString() || message.conversation?.toString();
            const messageId = message.id?.toString() || message._id?.toString();
            const senderId = message.senderId?.toString() || message.sender?._id?.toString();
            const isOwnMessage = senderId === user?.id?.toString() || message.isOwnMessage === true;
            
            console.log('Chat: Received message via socket', {
                messageChatId,
                messageId,
                senderId,
                userRole: user?.role,
                userId: user?.id?.toString(),
                isOwnMessage,
                adminChatId: adminChat?.id?.toString(),
                clientActiveChatId: clientActiveChatId?.toString(),
                activeChatId: activeChatId?.toString()
            });
            
            // For client view: update appropriate chat box
            if (user?.role === 'user') {
                // Also update client active messages if it matches
                if (clientActiveChatId && messageChatId === clientActiveChatId.toString()) {
                    setClientActiveMessages(prev => {
                        const exists = prev.some(m => {
                            const mId = m.id?.toString() || m._id?.toString();
                            return mId === messageId;
                        });
                        if (exists) return prev;
                        if (isOwnMessage) return prev;
                        const formattedMessage = {
                            ...message,
                            id: message.id || message._id,
                            _id: message._id || message.id,
                            chatId: messageChatId,
                            conversation: messageChatId,
                            senderId: senderId,
                            senderName: message.senderName || message.sender?.name || 'Unknown',
                            senderRole: message.senderRole || message.sender?.role || 'user',
                            text: message.text || message.message || '',
                            message: message.text || message.message || '',
                            timestamp: message.timestamp || message.createdAt || new Date(),
                            createdAt: message.createdAt || message.timestamp || new Date(),
                            isOwnMessage: false,
                        };
                        return [...prev, formattedMessage];
                    });
                }
                // Check if this is an admin chat message (support chat, no assignment)
                // First try to match by adminChat ID, but also check if it's a support chat by checking conversations
                const isAdminChatMessage = adminChat && messageChatId === adminChat.id?.toString();
                
                // If adminChat not set but message is for a support chat, try to find it
                if (!adminChat && !isAdminChatMessage) {
                    // Check if this conversation is a support chat by looking at conversations
                    const convo = conversations.find(c => c.id?.toString() === messageChatId);
                    if (convo && convo.isSupportChat) {
                        setAdminChat(convo);
                        // Reload messages for this chat
                        setTimeout(() => {
                            getChatMessages(messageChatId).then(res => {
                                const messagesData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
                                const formattedMessages = messagesData
                                    .filter(msg => (msg.text || msg.message || '').trim() !== '')
                                    .map(msg => {
                                        const text = msg.text || msg.message || '';
                                        const msgSenderId = msg.senderId || msg.sender?._id || msg.sender?.id;
                                        return {
                                            ...msg,
                                            id: msg.id || msg._id,
                                            _id: msg._id || msg.id,
                                            chatId: msg.chatId || msg.conversation || messageChatId,
                                            conversation: msg.conversation || msg.chatId || messageChatId,
                                            senderId: msgSenderId,
                                            senderName: msg.senderName || msg.sender?.name || 'Unknown',
                                            senderRole: msg.senderRole || msg.sender?.role || 'user',
                                            text: text,
                                            message: text,
                                            timestamp: msg.timestamp || msg.createdAt || new Date(),
                                            createdAt: msg.createdAt || msg.timestamp || new Date(),
                                            isOwnMessage: msgSenderId?.toString() === user?.id?.toString(),
                                            sender: msg.sender || {
                                                _id: msgSenderId,
                                                name: msg.senderName || msg.sender?.name || 'Unknown',
                                                role: msg.senderRole || msg.sender?.role || 'user'
                                            }
                                        };
                                    });
                                setAdminMessages(formattedMessages);
                            }).catch(err => console.error('Chat: Error loading messages for new admin chat', err));
                        }, 100);
                    }
                }
                
                if (isAdminChatMessage || (adminChat && messageChatId === adminChat.id?.toString())) {
                    setAdminMessages(prev => {
                        // Check if message already exists
                        const exists = prev.some(m => {
                            const mId = m.id?.toString() || m._id?.toString();
                            return mId === messageId;
                        });
                        if (exists) {
                            console.log('Chat: Message already exists in admin messages, skipping');
                            return prev;
                        }
                        // Only skip if it's our own message (already added from API response)
                        if (isOwnMessage) {
                            console.log('Chat: Skipping own message (already added from API)');
                            return prev;
                        }
                        console.log('Chat: Adding new message to admin chat from', message.senderName || message.senderRole);
                        const formattedMessage = {
                            ...message,
                            id: message.id || message._id,
                            _id: message._id || message.id,
                            chatId: messageChatId,
                            conversation: messageChatId,
                            senderId: senderId,
                            senderName: message.senderName || message.sender?.name || 'Unknown',
                            senderRole: message.senderRole || message.sender?.role || 'user',
                            text: message.text || message.message || '',
                            message: message.text || message.message || '',
                            timestamp: message.timestamp || message.createdAt || new Date(),
                            createdAt: message.createdAt || message.timestamp || new Date(),
                            isOwnMessage: false,
                            sender: message.sender || {
                                _id: senderId,
                                name: message.senderName || message.sender?.name || 'Unknown',
                                role: message.senderRole || message.sender?.role || 'user'
                            }
                        };
                        return [...prev, formattedMessage];
                    });
                } else if (writerChat && messageChatId === writerChat.id?.toString()) {
                    setWriterMessages(prev => {
                        const exists = prev.some(m => {
                            const mId = m.id?.toString() || m._id?.toString();
                            return mId === messageId;
                        });
                        if (exists) return prev;
                        if (isOwnMessage) return prev;
                        const formattedMessage = {
                            ...message,
                            id: message.id || message._id,
                            _id: message._id || message.id,
                            chatId: messageChatId,
                            conversation: messageChatId,
                            senderId: senderId,
                            senderName: message.senderName || message.sender?.name || 'Unknown',
                            senderRole: message.senderRole || message.sender?.role || 'user',
                            text: message.text || message.message || '',
                            message: message.text || message.message || '',
                            timestamp: message.timestamp || message.createdAt || new Date(),
                            createdAt: message.createdAt || message.timestamp || new Date(),
                            isOwnMessage: false,
                            sender: message.sender || {
                                _id: senderId,
                                name: message.senderName || message.sender?.name || 'Unknown',
                                role: message.senderRole || message.sender?.role || 'user'
                            }
                        };
                        return [...prev, formattedMessage];
                    });
                }
            } else {
                // For admin/writer view
                if (messageChatId === activeChatId?.toString()) {
                    setMessages(prev => {
                        const exists = prev.some(m => {
                            const mId = m.id?.toString() || m._id?.toString();
                            return mId === messageId;
                        });
                        if (exists) return prev;
                        if (isOwnMessage) return prev;
                        const formattedMessage = {
                            ...message,
                            id: message.id || message._id,
                            _id: message._id || message.id,
                            chatId: messageChatId,
                            conversation: messageChatId,
                            senderId: senderId,
                            senderName: message.senderName || message.sender?.name || 'Unknown',
                            senderRole: message.senderRole || message.sender?.role || 'user',
                            text: message.text || message.message || '',
                            message: message.text || message.message || '',
                            timestamp: message.timestamp || message.createdAt || new Date(),
                            createdAt: message.createdAt || message.timestamp || new Date(),
                            isOwnMessage: false,
                            sender: message.sender || {
                                _id: senderId,
                                name: message.senderName || message.sender?.name || 'Unknown',
                                role: message.senderRole || message.sender?.role || 'user'
                            }
                        };
                        return [...prev, formattedMessage];
                    });
                }
            }
        };

        const handleConversationUpdate = (updatedConvo) => {
            const formattedConvo = {
                id: updatedConvo.id || updatedConvo._id,
                name: updatedConvo.name || 'Unknown',
                avatar: updatedConvo.avatar || null,
                lastMessage: updatedConvo.lastMessage || 'Start a conversation!',
                lastMessageSender: updatedConvo.lastMessageSender || null,
                lastMessageSenderRole: updatedConvo.lastMessageSenderRole || null,
                isLastMessageFromOther: updatedConvo.isLastMessageFromOther !== undefined ? updatedConvo.isLastMessageFromOther : false,
                timestamp: updatedConvo.timestamp || '',
                lastMessageTime: updatedConvo.lastMessageTime || null,
                unread: updatedConvo.unread || 0,
                unreadCount: updatedConvo.unreadCount || updatedConvo.unread || 0,
                participants: Array.isArray(updatedConvo.participants) ? updatedConvo.participants.map(p => ({
                    id: p.id || p._id || p,
                    name: p.name || 'Unknown',
                    role: p.role || 'user',
                    avatar: p.avatar || null
                })) : [],
                assignmentId: updatedConvo.assignmentId || null,
                assignmentTitle: updatedConvo.assignmentTitle || null,
                isSupportChat: updatedConvo.isSupportChat !== undefined ? updatedConvo.isSupportChat : !updatedConvo.assignmentId,
                isAssignmentChat: updatedConvo.isAssignmentChat !== undefined ? updatedConvo.isAssignmentChat : !!updatedConvo.assignmentId,
                clientName: updatedConvo.clientName || null,
                writerName: updatedConvo.writerName || null,
                adminName: updatedConvo.adminName || null,
                isOnline: updatedConvo.isOnline || false,
            };

            // If this is the active chat and unread count is 0, ensure it's cleared
            if (formattedConvo.id === activeChatId && formattedConvo.unreadCount === 0) {
                formattedConvo.unread = 0;
                formattedConvo.unreadCount = 0;
            }

            setConversations(prevConvos => {
                const filtered = prevConvos.filter(c => c.id?.toString() !== formattedConvo.id?.toString());
                return [formattedConvo, ...filtered];
            });

            // Update client chat boxes if needed and reload messages if it's a new admin chat
            if (user?.role === 'user') {
                if (formattedConvo.isSupportChat) {
                    const wasNewAdminChat = !adminChat || adminChat.id?.toString() !== formattedConvo.id?.toString();
                    setAdminChat(formattedConvo);
                    // If this is a newly assigned admin chat, reload messages
                    if (wasNewAdminChat || adminMessages.length === 0) {
                        setTimeout(() => {
                            getChatMessages(formattedConvo.id).then(res => {
                                const messagesData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
                                const formattedMessages = messagesData
                                    .filter(msg => (msg.text || msg.message || '').trim() !== '')
                                    .map(msg => {
                                        const text = msg.text || msg.message || '';
                                        const senderId = msg.senderId || msg.sender?._id || msg.sender?.id;
                                        return {
                                            ...msg,
                                            id: msg.id || msg._id,
                                            _id: msg._id || msg.id,
                                            chatId: msg.chatId || msg.conversation || formattedConvo.id,
                                            conversation: msg.conversation || msg.chatId || formattedConvo.id,
                                            senderId: senderId,
                                            senderName: msg.senderName || msg.sender?.name || 'Unknown',
                                            senderRole: msg.senderRole || msg.sender?.role || 'user',
                                            text: text,
                                            message: text,
                                            timestamp: msg.timestamp || msg.createdAt || new Date(),
                                            createdAt: msg.createdAt || msg.timestamp || new Date(),
                                            isOwnMessage: msg.isOwnMessage !== undefined 
                                                ? msg.isOwnMessage 
                                                : (senderId?.toString() === user?.id?.toString() || senderId === user?.id),
                                            sender: msg.sender || {
                                                _id: senderId,
                                                name: msg.senderName || msg.sender?.name || 'Unknown',
                                                role: msg.senderRole || msg.sender?.role || 'user'
                                            }
                                        };
                                    });
                                setAdminMessages(formattedMessages);
                            }).catch(err => console.error('Chat: Error reloading admin messages on update', err));
                        }, 500);
                    }
                } else if (formattedConvo.isAssignmentChat) {
                    setWriterChat(formattedConvo);
                }
            }
        };

        socket.on('receiveMessage', handleReceiveMessage);
        socket.on('updateConversation', handleConversationUpdate);

        return () => {
            socket.off('receiveMessage', handleReceiveMessage);
            socket.off('updateConversation', handleConversationUpdate);
        };
    }, [socket, user, adminChat, writerChat, activeChatId, clientActiveChatId, conversations, adminMessages]);

    // Auto-scroll for admin chat
    useEffect(() => {
        if (adminChatBodyRef.current) {
            setTimeout(() => {
                if (adminChatBodyRef.current) {
                    adminChatBodyRef.current.scrollTop = adminChatBodyRef.current.scrollHeight;
                }
            }, 100);
        }
    }, [adminMessages]);

    // Auto-scroll for writer chat
    useEffect(() => {
        if (writerChatBodyRef.current) {
            setTimeout(() => {
                if (writerChatBodyRef.current) {
                    writerChatBodyRef.current.scrollTop = writerChatBodyRef.current.scrollHeight;
                }
            }, 100);
        }
    }, [writerMessages]);

    // Auto-scroll for single chat
    useEffect(() => {
        if (chatBodyRef.current) {
            setTimeout(() => {
                if (chatBodyRef.current) {
                    chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
                }
            }, 100);
        }
    }, [messages, activeChatId]);


    // Helper function to get admin chat with retry
    const getAdminChatWithRetry = async (maxRetries = 5) => {
        for (let i = 0; i < maxRetries; i++) {
            try {
                console.log(`Chat: Attempting to get admin chat (attempt ${i + 1}/${maxRetries})...`);
                const res = await getConversations();
                const conversationsData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
                console.log(`Chat: Received ${conversationsData.length} conversations`);
                const formattedConversations = formatConversations(conversationsData);
                const foundAdminChat = formattedConversations.find(c => c.isSupportChat);
                
                if (foundAdminChat) {
                    console.log(`Chat: ✅ Found admin chat on attempt ${i + 1}:`, foundAdminChat.id);
                    return { adminChat: foundAdminChat, conversations: formattedConversations };
                }
                
                console.log(`Chat: ⚠️ Admin chat not found on attempt ${i + 1}, conversations:`, formattedConversations.map(c => ({ id: c.id, name: c.name, isSupport: c.isSupportChat })));
                
                // If not found and not last retry, wait a bit before retrying with exponential backoff
                if (i < maxRetries - 1) {
                    const waitTime = 1000 * (i + 1); // 1s, 2s, 3s, 4s, 5s
                    console.log(`Chat: Waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            } catch (error) {
                console.error(`Chat: ❌ Failed to get conversations (attempt ${i + 1})`, error);
                if (i === maxRetries - 1) {
                    console.error('Chat: All retries exhausted, throwing error');
                    throw error;
                }
                // Wait before retrying on error too
                const waitTime = 1000 * (i + 1);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        console.warn('Chat: Admin chat not found after all retries');
        return null;
    };

    // Send message handlers
    const handleSendAdminMessage = async (e) => {
        e.preventDefault();
        const messageText = adminNewMessage.trim();
        if (messageText === '' || !user) return;
        
        // Clear input immediately
        setAdminNewMessage('');
        setAdminErrorMessage(null);
        
        // If admin chat doesn't exist, try to get it first
        let currentAdminChat = adminChat;
        if (!currentAdminChat) {
            setAdminErrorMessage('Creating chat...');
            try {
                console.log('Chat: Admin chat not found, fetching conversations...');
                // Quick attempt to get admin chat
                const res = await getConversations();
                const conversationsData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
                console.log('Chat: Received conversations:', conversationsData.length);
                const formattedConversations = formatConversations(conversationsData);
                console.log('Chat: Formatted conversations:', formattedConversations.map(c => ({ id: c.id, name: c.name, isSupport: c.isSupportChat })));
                const foundAdminChat = formattedConversations.find(c => c.isSupportChat);
                
                if (foundAdminChat) {
                    console.log('Chat: ✅ Found admin chat:', foundAdminChat.id);
                    currentAdminChat = foundAdminChat;
                    setAdminChat(foundAdminChat);
                    setConversations(formattedConversations);
                    setAdminErrorMessage(null);
                } else {
                    console.log('Chat: Admin chat not in first response, waiting and retrying...');
                    // If still not found, wait a bit and try once more
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    const retryRes = await getConversations();
                    const retryData = Array.isArray(retryRes.data) ? retryRes.data : (retryRes.data?.data || []);
                    console.log('Chat: Retry received conversations:', retryData.length);
                    const retryFormatted = formatConversations(retryData);
                    const retryAdminChat = retryFormatted.find(c => c.isSupportChat);
                    
                    if (retryAdminChat) {
                        console.log('Chat: ✅ Found admin chat on retry:', retryAdminChat.id);
                        currentAdminChat = retryAdminChat;
                        setAdminChat(retryAdminChat);
                        setConversations(retryFormatted);
                        setAdminErrorMessage(null);
                    } else {
                        console.error('Chat: ❌ Admin chat not found after retries');
                        console.error('Chat: Available conversations:', retryFormatted.map(c => ({ id: c.id, name: c.name, isSupport: c.isSupportChat, assignmentId: c.assignmentId })));
                        // Check if there's an admin user in the system
                        setAdminErrorMessage('Admin chat is not available. Please ensure an admin user exists in the system. Contact support if this issue persists.');
                        setAdminNewMessage(messageText); // Restore message
                        setTimeout(() => setAdminErrorMessage(null), 15000);
                        return;
                    }
                }
            } catch (error) {
                console.error('Chat: ❌ Failed to get admin chat', error);
                console.error('Chat: Error details:', error.response?.data || error.message);
                const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
                setAdminErrorMessage(`Unable to load chat: ${errorMsg}. Please refresh the page or contact support.`);
                setAdminNewMessage(messageText); // Restore message
                setTimeout(() => setAdminErrorMessage(null), 15000);
                return;
            }
        }
        
        // Send the message
        try {
            setAdminErrorMessage(null);
            console.log('Chat: Sending message to admin chat:', currentAdminChat.id, messageText);
            const sentMessage = await postChatMessage(currentAdminChat.id, messageText);
            // Format the message properly
            const messageData = sentMessage.data || sentMessage;
            const formattedMessage = {
                id: messageData.id || messageData._id,
                _id: messageData._id || messageData.id,
                chatId: currentAdminChat.id,
                conversation: currentAdminChat.id,
                senderId: messageData.senderId || user?.id,
                senderName: user?.name || messageData.senderName || 'You',
                senderRole: user?.role || messageData.senderRole || 'user',
                text: messageData.text || messageText,
                message: messageData.text || messageData.message || messageText,
                timestamp: messageData.timestamp || messageData.createdAt || new Date(),
                createdAt: messageData.createdAt || messageData.timestamp || new Date(),
                isOwnMessage: true,
                sender: {
                    _id: messageData.senderId || user?.id,
                    name: user?.name || messageData.senderName || 'You',
                    role: user?.role || messageData.senderRole || 'user'
                }
            };
            
            console.log('Chat: ✅ Message sent successfully, adding to chat:', formattedMessage);
            
            // Add message to the list
            setAdminMessages(prev => {
                const exists = prev.some(m => {
                    const mId = m.id?.toString() || m._id?.toString();
                    const newId = formattedMessage.id?.toString();
                    return mId === newId;
                });
                if (exists) {
                    console.log('Chat: Message already in list');
                    return prev;
                }
                console.log('Chat: Adding new message to list, total messages:', prev.length + 1);
                return [...prev, formattedMessage];
            });
            
            setAdminErrorMessage(null);
            
            // Reload messages after a short delay to get any updates
            setTimeout(async () => {
                try {
                    const res = await getChatMessages(currentAdminChat.id);
                    const messagesData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
                    const formattedMessages = messagesData
                        .filter(msg => (msg.text || msg.message || '').trim() !== '')
                        .map(msg => {
                            const text = msg.text || msg.message || '';
                            const senderId = msg.senderId || msg.sender?._id || msg.sender?.id;
                            return {
                                ...msg,
                                id: msg.id || msg._id,
                                _id: msg._id || msg.id,
                                chatId: msg.chatId || msg.conversation || currentAdminChat.id,
                                conversation: msg.conversation || msg.chatId || currentAdminChat.id,
                                senderId: senderId,
                                senderName: msg.senderName || msg.sender?.name || 'Unknown',
                                senderRole: msg.senderRole || msg.sender?.role || 'user',
                                text: text,
                                message: text,
                                timestamp: msg.timestamp || msg.createdAt || new Date(),
                                createdAt: msg.createdAt || msg.timestamp || new Date(),
                                isOwnMessage: msg.isOwnMessage !== undefined 
                                    ? msg.isOwnMessage 
                                    : (senderId?.toString() === user?.id?.toString() || senderId === user?.id),
                                sender: msg.sender || {
                                    _id: senderId,
                                    name: msg.senderName || msg.sender?.name || 'Unknown',
                                    role: msg.senderRole || msg.sender?.role || 'user'
                                }
                            };
                        });
                    setAdminMessages(formattedMessages);
                    console.log('Chat: Reloaded messages, count:', formattedMessages.length);
                } catch (err) {
                    console.error('Chat: Error reloading messages', err);
                }
            }, 1000);
        } catch (error) {
            console.error("Chat: ❌ Failed to send admin message", error);
            const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to send message.';
            
            // If 404, try to reload chat and retry once
            if (error.response?.status === 404) {
                console.log('Chat: 404 - Chat not found, reloading...');
                setAdminErrorMessage('Reloading chat...');
                try {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    const res = await getConversations();
                    const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
                    const formatted = formatConversations(data);
                    const adminChat = formatted.find(c => c.isSupportChat);
                    
                    if (adminChat) {
                        setAdminChat(adminChat);
                        setConversations(formatted);
                        // Retry sending
                        try {
                            const retryMsg = await postChatMessage(adminChat.id, messageText);
                            const retryData = retryMsg.data || retryMsg;
                            const retryFormatted = {
                                id: retryData.id || retryData._id,
                                _id: retryData._id || retryData.id,
                                chatId: adminChat.id,
                                conversation: adminChat.id,
                                senderId: retryData.senderId || user?.id,
                                senderName: user?.name || retryData.senderName || 'You',
                                senderRole: user?.role || retryData.senderRole || 'user',
                                text: retryData.text || messageText,
                                message: retryData.text || retryData.message || messageText,
                                timestamp: retryData.timestamp || retryData.createdAt || new Date(),
                                createdAt: retryData.createdAt || retryData.timestamp || new Date(),
                                isOwnMessage: true,
                                sender: {
                                    _id: retryData.senderId || user?.id,
                                    name: user?.name || retryData.senderName || 'You',
                                    role: user?.role || retryData.senderRole || 'user'
                                }
                            };
                            setAdminMessages(prev => {
                                const exists = prev.some(m => {
                                    const mId = m.id?.toString() || m._id?.toString();
                                    return mId === retryFormatted.id?.toString();
                                });
                                return exists ? prev : [...prev, retryFormatted];
                            });
                            setAdminErrorMessage(null);
                            console.log('Chat: ✅ Message sent after retry');
                        } catch (retryErr) {
                            console.error('Chat: Retry send failed', retryErr);
                            setAdminErrorMessage('Failed to send. Please try again.');
                            setAdminNewMessage(messageText);
                            setTimeout(() => setAdminErrorMessage(null), 8000);
                        }
                    } else {
                        setAdminErrorMessage('Chat unavailable. Please refresh the page.');
                        setAdminNewMessage(messageText);
                        setTimeout(() => setAdminErrorMessage(null), 10000);
                    }
                } catch (reloadErr) {
                    console.error('Chat: Reload failed', reloadErr);
                    setAdminErrorMessage('Unable to send message. Please refresh the page.');
                    setAdminNewMessage(messageText);
                    setTimeout(() => setAdminErrorMessage(null), 10000);
                }
            } else {
                setAdminErrorMessage(errorMsg);
                setAdminNewMessage(messageText);
                setTimeout(() => setAdminErrorMessage(null), 8000);
            }
        }
    };

    const handleSendWriterMessage = async (e) => {
        e.preventDefault();
        if (writerNewMessage.trim() === '' || !user || !writerChat) return;
        
        // Validate contact info for writer chat
        const validation = validateNoContactInfo(writerNewMessage.trim());
        if (!validation.isValid) {
            setWriterErrorMessage(validation.errorMessage || 'This message contains restricted information.');
            setTimeout(() => setWriterErrorMessage(null), 8000);
            return;
        }

        try {
            const sentMessage = await postChatMessage(writerChat.id, writerNewMessage);
            const formattedMessage = {
                ...sentMessage.data,
                id: sentMessage.data.id || sentMessage.data._id,
                senderId: sentMessage.data.senderId || user?.id,
                senderName: user?.name,
                isOwnMessage: true,
            };
            setWriterMessages(prev => {
                const exists = prev.some(m => m.id?.toString() === formattedMessage.id?.toString());
                if (exists) return prev;
                return [...prev, formattedMessage];
            });
            setWriterNewMessage('');
            setWriterErrorMessage(null);
        } catch (error) {
            console.error("Chat: Failed to send writer message", error);
            const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to send message.';
            setWriterErrorMessage(errorMsg);
            setTimeout(() => setWriterErrorMessage(null), 8000);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (newMessage.trim() === '' || !user || !activeChatId) return;
        
        const activeConversation = conversations.find(c => c.id === activeChatId);
        if (!activeConversation) return;

        if (user.role === 'user' || user.role === 'writer') {
            const isAdminChat = activeConversation.isSupportChat;
            if (!isAdminChat) {
                const validation = validateNoContactInfo(newMessage.trim());
                if (!validation.isValid) {
                    setErrorMessage(validation.errorMessage || 'This message contains restricted information.');
                    setTimeout(() => setErrorMessage(null), 8000);
                    return;
                }
            }
        }

        try {
            const sentMessage = await postChatMessage(activeChatId, newMessage);
            const formattedMessage = {
                ...sentMessage.data,
                id: sentMessage.data.id || sentMessage.data._id,
                senderId: sentMessage.data.senderId || user?.id,
                senderName: user?.name,
                isOwnMessage: true,
            };
            setMessages(prev => {
                const exists = prev.some(m => m.id?.toString() === formattedMessage.id?.toString());
                if (exists) return prev;
                return [...prev, formattedMessage];
            });
            setNewMessage('');
            setErrorMessage(null);
        } catch (error) {
            console.error("Chat: Failed to send message", error);
            const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to send message.';
            setErrorMessage(errorMsg);
            setTimeout(() => setErrorMessage(null), 8000);
        }
    };

    // Set initial active chat for client
    useEffect(() => {
        if (user?.role === 'user') {
            const allClientChats = [];
            if (adminChat) {
                allClientChats.push(adminChat);
            }
            if (writerChat) {
                allClientChats.push(writerChat);
            }
            if (allClientChats.length > 0 && !clientActiveChatId) {
                setClientActiveChatId(allClientChats[0].id);
            }
        }
    }, [adminChat, writerChat, user?.role, clientActiveChatId]);

    // Sync messages for client active chat
    useEffect(() => {
        if (user?.role !== 'user' || !clientActiveChatId) return;
        
        const allClientChats = [];
        if (adminChat) {
            allClientChats.push({ ...adminChat, chatType: 'admin' });
        }
        if (writerChat) {
            allClientChats.push({ ...writerChat, chatType: 'writer' });
        }
        
        const activeChat = allClientChats.find(c => c.id === clientActiveChatId);
        if (!activeChat) return;

        // Use appropriate messages based on chat type
        if (activeChat.chatType === 'admin') {
            setClientActiveMessages(adminMessages);
        } else if (activeChat.chatType === 'writer') {
            setClientActiveMessages(writerMessages);
        }
    }, [clientActiveChatId, adminMessages, writerMessages, adminChat, writerChat, user?.role]);

    // Auto-scroll for client active chat
    useEffect(() => {
        if (clientActiveChatBodyRef.current && user?.role === 'user') {
            setTimeout(() => {
                if (clientActiveChatBodyRef.current) {
                    clientActiveChatBodyRef.current.scrollTop = clientActiveChatBodyRef.current.scrollHeight;
                }
            }, 100);
        }
    }, [clientActiveMessages, user?.role]);

    // Handle sending message for client active chat
    const handleSendClientActiveMessage = async (e) => {
        e.preventDefault();
        const messageText = clientActiveNewMessage.trim();
        if (messageText === '' || !user || !clientActiveChatId) return;

        const allClientChats = [];
        if (adminChat) {
            allClientChats.push({ ...adminChat, chatType: 'admin' });
        }
        if (writerChat) {
            allClientChats.push({ ...writerChat, chatType: 'writer' });
        }
        
        const activeChat = allClientChats.find(c => c.id === clientActiveChatId);
        if (!activeChat) return;

        // Validate contact info for writer chats (and optionally admin chats)
        if (activeChat.chatType === 'writer') {
            const validation = validateNoContactInfo(messageText);
            if (!validation.isValid) {
                setWriterErrorMessage(validation.errorMessage || 'This message contains restricted information.');
                setClientActiveContactWarning(validation.errorMessage || 'This message contains restricted information.');
                setClientActiveNewMessage(messageText); // Keep message for user to fix
                setTimeout(() => {
                    setWriterErrorMessage(null);
                    setClientActiveContactWarning(null);
                }, 8000);
                return; // Block sending
            }
        }

        // Clear input immediately
        setClientActiveNewMessage('');
        setClientActiveContactWarning(null);

        // Use appropriate handler based on chat type
        if (activeChat.chatType === 'admin') {
            // Set the admin message state and trigger send
            setAdminNewMessage(messageText);
            try {
                const sentMessage = await postChatMessage(activeChat.id, messageText);
                const messageData = sentMessage.data || sentMessage;
                const formattedMessage = {
                    id: messageData.id || messageData._id,
                    _id: messageData._id || messageData.id,
                    chatId: activeChat.id,
                    conversation: activeChat.id,
                    senderId: messageData.senderId || user?.id,
                    senderName: user?.name || messageData.senderName || 'You',
                    senderRole: user?.role || messageData.senderRole || 'user',
                    text: messageData.text || messageText,
                    message: messageData.text || messageData.message || messageText,
                    timestamp: messageData.timestamp || messageData.createdAt || new Date(),
                    createdAt: messageData.createdAt || messageData.timestamp || new Date(),
                    isOwnMessage: true,
                };
                setAdminMessages(prev => {
                    const exists = prev.some(m => {
                        const mId = m.id?.toString() || m._id?.toString();
                        return mId === formattedMessage.id?.toString();
                    });
                    return exists ? prev : [...prev, formattedMessage];
                });
                setClientActiveMessages(prev => {
                    const exists = prev.some(m => {
                        const mId = m.id?.toString() || m._id?.toString();
                        return mId === formattedMessage.id?.toString();
                    });
                    return exists ? prev : [...prev, formattedMessage];
                });
                setAdminNewMessage('');
            } catch (error) {
                console.error("Chat: Failed to send admin message", error);
                const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to send message.';
                setAdminErrorMessage(errorMsg);
                setClientActiveNewMessage(messageText); // Restore message
                setTimeout(() => setAdminErrorMessage(null), 8000);
            }
        } else if (activeChat.chatType === 'writer') {
            // Set the writer message state and trigger send
            setWriterNewMessage(messageText);
            try {
                const sentMessage = await postChatMessage(activeChat.id, messageText);
                const formattedMessage = {
                    ...sentMessage.data,
                    id: sentMessage.data.id || sentMessage.data._id,
                    senderId: sentMessage.data.senderId || user?.id,
                    senderName: user?.name,
                    isOwnMessage: true,
                };
                setWriterMessages(prev => {
                    const exists = prev.some(m => m.id?.toString() === formattedMessage.id?.toString());
                    return exists ? prev : [...prev, formattedMessage];
                });
                setClientActiveMessages(prev => {
                    const exists = prev.some(m => m.id?.toString() === formattedMessage.id?.toString());
                    return exists ? prev : [...prev, formattedMessage];
                });
                setWriterNewMessage('');
            } catch (error) {
                console.error("Chat: Failed to send writer message", error);
                const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to send message.';
                setWriterErrorMessage(errorMsg);
                setClientActiveNewMessage(messageText); // Restore message
                setTimeout(() => setWriterErrorMessage(null), 8000);
            }
        }
    };

    // CLIENT VIEW: Three-panel layout (Chat List + Active Chat)
    if (user?.role === 'user') {
        const allClientChats = [];
        if (adminChat) {
            allClientChats.push({ ...adminChat, chatType: 'admin', isSupportChat: true });
        }
        if (writerChat) {
            allClientChats.push({ ...writerChat, chatType: 'writer', isAssignmentChat: true });
        }
        
        const activeConversation = allClientChats.find(c => c.id === clientActiveChatId);

        return (
            <div className="flex h-screen bg-white overflow-hidden">
                {/* Middle Panel: Chat List */}
                <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
                    <div className="p-4 border-b border-gray-200">
                        <h2 className="text-xl font-bold text-gray-800">Your Chats</h2>
                    </div>
                    <div className="flex-grow overflow-y-auto">
                        {loading.convos ? (
                            <div className="p-4 text-gray-500 text-sm">Loading conversations...</div>
                        ) : allClientChats.length === 0 ? (
                            <div className="p-4 text-gray-500 text-sm">No conversations yet</div>
                        ) : (
                            allClientChats.map(chat => (
                                <div
                                    key={chat.id}
                                    onClick={() => setClientActiveChatId(chat.id)}
                                    className={`flex items-start p-3 cursor-pointer transition-all border-b border-gray-100 ${
                                        clientActiveChatId === chat.id 
                                            ? 'bg-purple-50 border-l-4 border-purple-600' 
                                            : 'hover:bg-gray-50 border-l-4 border-transparent'
                                    }`}
                                >
                                    <Avatar user={chat} className="w-12 h-12 mr-3 flex-shrink-0" />
                                    <div className="flex-grow overflow-hidden min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <h3 className={`font-semibold truncate text-sm ${clientActiveChatId === chat.id ? 'text-purple-700' : 'text-gray-800'}`}>
                                                {chat.name}
                                            </h3>
                                        </div>
                                        <p className={`text-xs truncate ${clientActiveChatId === chat.id ? 'text-gray-700' : 'text-gray-500'}`}>
                                            {chat.lastMessage || 'No messages yet'}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Panel: Active Chat */}
                <div className="flex-1 flex flex-col bg-white">
                    {activeConversation ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 border-b border-gray-200 bg-white flex items-center">
                                <Avatar user={activeConversation} className="w-10 h-10 mr-3" />
                                <div>
                                    <h2 className="text-base font-semibold text-gray-800">{activeConversation.name || 'Chat'}</h2>
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div 
                                ref={clientActiveChatBodyRef} 
                                className="flex-1 p-4 overflow-y-auto bg-white"
                                style={{ 
                                    scrollBehavior: 'smooth',
                                    scrollbarWidth: 'thin',
                                    scrollbarColor: '#e5e7eb #ffffff'
                                }}
                            >
                                {clientActiveChatLoading ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col">
                                        {clientActiveMessages && Array.isArray(clientActiveMessages) && clientActiveMessages.length > 0 ? (
                                            clientActiveMessages
                                                .filter(msg => (msg.text || msg.message || '').trim() !== '')
                                                .map((msg, idx) => {
                                                    const messageText = (msg.text || msg.message || '').trim();
                                                    const isOwn = msg.isOwnMessage !== undefined 
                                                        ? msg.isOwnMessage 
                                                        : (msg.senderId?.toString() === user?.id?.toString() || msg.senderId === user?.id);
                                                    const prevMessage = idx > 0 ? clientActiveMessages[idx - 1] : null;
                                                    const showDate = !prevMessage || 
                                                        formatMessageDate(msg.timestamp) !== formatMessageDate(prevMessage.timestamp);
                                                    const messageTimestamp = msg.timestamp || msg.createdAt || new Date();
                                                    
                                                    return (
                                                        <div key={msg.id || msg._id || `msg-${idx}`}>
                                                            {showDate && (
                                                                <div className="flex items-center justify-center my-4">
                                                                    <div className="bg-gray-200 text-gray-600 text-xs font-medium px-3 py-1 rounded-full">
                                                                        {formatMessageDate(messageTimestamp)}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
                                                                <div className={`rounded-lg px-4 py-2 max-w-[70%] ${
                                                                    isOwn 
                                                                        ? 'bg-purple-600 text-white' 
                                                                        : 'bg-gray-100 text-gray-900'
                                                                }`}>
                                                                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{messageText}</p>
                                                                    <span className={`text-[10px] mt-1 block ${isOwn ? 'text-purple-100' : 'text-gray-500'}`}>
                                                                        {formatTime(messageTimestamp)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                        ) : (
                                            <div className="flex items-center justify-center h-full">
                                                <p className="text-gray-400 text-sm">No messages yet. Start the conversation!</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Input Area */}
                            <div className="p-4 bg-white border-t border-gray-200">
                                {(activeConversation?.chatType === 'writer' ? writerErrorMessage : adminErrorMessage) && (
                                    <div className="mb-3 p-3 bg-red-50 border-l-4 border-red-500 rounded">
                                        <p className="text-sm font-medium text-red-800">{activeConversation?.chatType === 'writer' ? writerErrorMessage : adminErrorMessage}</p>
                                    </div>
                                )}
                                {clientActiveContactWarning && activeConversation?.chatType === 'writer' && (
                                    <div className="mb-3 p-3 bg-red-50 border-l-4 border-red-500 rounded">
                                        <p className="text-xs font-medium text-red-800">{clientActiveContactWarning}</p>
                                    </div>
                                )}
                                <form onSubmit={handleSendClientActiveMessage} className="flex items-center space-x-3">
                                    <button
                                        type="button"
                                        className="text-gray-500 hover:text-gray-700 p-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                        </svg>
                                    </button>
                                    <input
                                        type="text"
                                        placeholder="Type your message..."
                                        value={clientActiveNewMessage}
                                        onChange={e => {
                                            const value = e.target.value;
                                            setClientActiveNewMessage(value);
                                            if (clientActiveErrorMessage) setClientActiveErrorMessage(null);
                                            // Check for contact info in writer chats
                                            if (activeConversation?.chatType === 'writer') {
                                                const validation = validateNoContactInfo(value);
                                                setClientActiveContactWarning(!validation.isValid);
                                            } else {
                                                setClientActiveContactWarning(false);
                                            }
                                        }}
                                        className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!clientActiveNewMessage.trim()}
                                        className="bg-purple-600 text-white rounded-full p-3 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
                                    >
                                        <SendIcon className="w-5 h-5" />
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-500">
                            <p>Select a conversation to start chatting.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // NON-CLIENT VIEW: Original sidebar + single chat (for admin/writer)
    const activeConversation = conversations.find(c => c.id === activeChatId) || 
                               (conversations.length > 0 ? conversations[0] : null);

    const supportChats = user?.role === 'admin' ? conversations.filter(c => c.isSupportChat) : [];
    const assignmentChats = user?.role === 'admin' ? conversations.filter(c => c.isAssignmentChat) : [];
    const otherChats = user?.role !== 'admin' ? conversations : [];

    const renderConversationItem = (convo) => {
        const handleClick = () => {
            // Immediately update conversation unread count when clicked (optimistic update)
            setConversations(prev => prev.map(c => {
                if (c.id === convo.id || String(c.id) === String(convo.id)) {
                    return { ...c, unread: 0, unreadCount: 0 };
                }
                return c;
            }));
            
            // Also update assignment unread count if this is an assignment chat
            if (convo.assignmentId) {
                updateUnreadCount(convo.assignmentId, 0);
            }
            
            setActiveChatId(convo.id);
        };
        
        // Get the current unread count from conversations state (may have been updated optimistically)
        const currentConvo = conversations.find(c => c.id === convo.id || String(c.id) === String(convo.id));
        const unreadCount = currentConvo?.unreadCount ?? convo.unreadCount ?? 0;
        
        return (
            <div
                key={convo.id}
                onClick={handleClick}
                className={`flex items-start p-3 cursor-pointer transition-all ${
                    activeChatId === convo.id 
                        ? 'bg-indigo-50 border-l-4 border-indigo-600 shadow-sm' 
                        : 'hover:bg-gray-100 border-l-4 border-transparent'
                }`}
            >
                <div className="relative flex-shrink-0">
                    <Avatar user={convo} className="w-11 h-11 mr-3" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </div>
                <div className="flex-grow overflow-hidden min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className={`font-semibold truncate ${unreadCount > 0 ? 'text-indigo-700' : 'text-gray-800'}`}>
                            {convo.name}
                        </h3>
                        {convo.lastMessageTime && (
                            <span className={`text-[10px] flex-shrink-0 ${unreadCount > 0 ? 'text-indigo-600 font-semibold' : 'text-gray-500'}`}>
                                {new Date(convo.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                    </div>
                    <p className={`text-xs truncate ${unreadCount > 0 ? 'text-gray-800 font-medium' : 'text-gray-600'}`}>
                        {convo.lastMessage || 'No messages yet'}
                    </p>
                </div>
            </div>
        );
    };

    // NON-CLIENT VIEW: Three-panel layout (for admin/writer)
    return (
        <div className="flex h-screen bg-white overflow-hidden">
            {/* Middle Panel: Chat List */}
            <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-800">Your Chats</h2>
                    {user?.role === 'admin' && conversations.length > 0 && (
                        <div className="flex gap-2 text-xs mt-2">
                            <span className="text-gray-600">Support: <span className="font-semibold text-gray-800">{supportChats.length}</span></span>
                            <span className="text-gray-400">|</span>
                            <span className="text-gray-600">Assignments: <span className="font-semibold text-gray-800">{assignmentChats.length}</span></span>
                        </div>
                    )}
                </div>
                <div className="flex-grow overflow-y-auto">
                    {loading.convos ? (
                        <div className="p-4 text-gray-500 text-sm">Loading conversations...</div>
                    ) : conversations.length === 0 ? (
                        <div className="p-4 text-gray-500 text-sm">No conversations yet</div>
                    ) : user?.role === 'admin' ? (
                        <>
                            {supportChats.length > 0 && (
                                <>
                                    <div className="px-4 py-2 bg-gray-100 border-b border-gray-200">
                                        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Support Chats</h3>
                                    </div>
                                    {supportChats.map(renderConversationItem)}
                                </>
                            )}
                            {assignmentChats.length > 0 && (
                                <>
                                    <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 border-t border-gray-200">
                                        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Assignment Chats</h3>
                                    </div>
                                    {assignmentChats.map(renderConversationItem)}
                                </>
                            )}
                        </>
                    ) : (
                        otherChats.map(renderConversationItem)
                    )}
                </div>
            </div>

            {/* Right Panel: Active Chat */}
            <div className="flex-1 flex flex-col bg-white">
                {activeConversation ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b border-gray-200 bg-white flex items-center">
                            <Avatar user={activeConversation} className="w-10 h-10 mr-3" />
                            <div>
                                <h2 className="text-base font-semibold text-gray-800">{activeConversation.name || 'Chat'}</h2>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div 
                            ref={chatBodyRef} 
                            className="flex-1 p-4 overflow-y-auto bg-white"
                            style={{ 
                                scrollBehavior: 'smooth',
                                scrollbarWidth: 'thin',
                                scrollbarColor: '#e5e7eb #ffffff'
                            }}
                        >
                            {loading.messages ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                                </div>
                            ) : (
                                <div className="flex flex-col">
                                    {messages && Array.isArray(messages) && messages.length > 0 ? (
                                        messages
                                            .filter(msg => (msg.text || msg.message || '').trim() !== '')
                                            .map((msg, idx) => {
                                                const messageText = (msg.text || msg.message || '').trim();
                                                const isOwn = msg.isOwnMessage !== undefined 
                                                    ? msg.isOwnMessage 
                                                    : (msg.senderId?.toString() === user?.id?.toString() || msg.senderId === user?.id);
                                                const prevMessage = idx > 0 ? messages[idx - 1] : null;
                                                const showDate = !prevMessage || 
                                                    formatMessageDate(msg.timestamp) !== formatMessageDate(prevMessage.timestamp);
                                                const messageTimestamp = msg.timestamp || msg.createdAt || new Date();
                                                
                                                return (
                                                    <div key={msg.id || msg._id || `msg-${idx}`}>
                                                        {showDate && (
                                                            <div className="flex items-center justify-center my-4">
                                                                <div className="bg-gray-200 text-gray-600 text-xs font-medium px-3 py-1 rounded-full">
                                                                    {formatMessageDate(messageTimestamp)}
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
                                                            <div className={`rounded-lg px-4 py-2 max-w-[70%] ${
                                                                isOwn 
                                                                    ? 'bg-purple-600 text-white' 
                                                                    : 'bg-gray-100 text-gray-900'
                                                            }`}>
                                                                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{messageText}</p>
                                                                <span className={`text-[10px] mt-1 block ${isOwn ? 'text-purple-100' : 'text-gray-500'}`}>
                                                                    {formatTime(messageTimestamp)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                    ) : (
                                        <div className="flex items-center justify-center h-full">
                                            <p className="text-gray-400 text-sm">No messages yet. Start the conversation!</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white border-t border-gray-200">
                            {errorMessage && (
                                <div className="mb-3 p-3 bg-red-50 border-l-4 border-red-500 rounded">
                                    <p className="text-sm font-medium text-red-800">{errorMessage}</p>
                                </div>
                            )}
                            {contactWarning && (user?.role === 'user' || user?.role === 'writer') && activeConversation && !activeConversation.isSupportChat && (
                                <div className="mb-3 p-3 bg-red-50 border-l-4 border-red-500 rounded">
                                    <p className="text-xs font-medium text-red-800">{contactWarning}</p>
                                </div>
                            )}
                            <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
                                <button
                                    type="button"
                                    className="text-gray-500 hover:text-gray-700 p-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                </button>
                                <input
                                    type="text"
                                    placeholder="Type your message..."
                                    value={newMessage}
                                    onChange={e => {
                                        const value = e.target.value;
                                        setNewMessage(value);
                                        if (errorMessage) setErrorMessage(null);
                                        // Check for contact info in non-support chats for users/writers
                                        if ((user?.role === 'user' || user?.role === 'writer') && activeConversation && !activeConversation.isSupportChat) {
                                            const validation = validateNoContactInfo(value);
                                            setContactWarning(validation.isValid ? null : (validation.errorMessage || 'This message contains restricted information.'));
                                        } else {
                                            setContactWarning(null);
                                        }
                                    }}
                                    className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                />
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim()}
                                    className="bg-purple-600 text-white rounded-full p-3 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
                                >
                                    <SendIcon className="w-5 h-5" />
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500">
                        {loading.convos ? <p>Loading conversations...</p> : <p>Select a conversation to start chatting.</p>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatPage;
