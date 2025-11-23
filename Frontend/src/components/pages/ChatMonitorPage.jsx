import React, { useState, useEffect, useRef } from 'react';
import SendIcon from '../icons/SendIcon';
import PaperClipIcon from '../icons/PaperClipIcon';
import { getConversations, getChatMessages, postChatMessage } from '../../services/api';
import Avatar from '../shared/Avatar';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';

const ChatMessageBubble = ({ message }) => {
    // Determine message sender role for color coding
    const senderRole = message.senderRole || (message.senderName?.toLowerCase().includes('admin') ? 'admin' : 'user');
    const roleColors = {
        'admin': 'bg-indigo-50 border-indigo-200',
        'writer': 'bg-purple-50 border-purple-200',
        'user': 'bg-blue-50 border-blue-200'
    };
    const textColors = {
        'admin': 'text-indigo-800',
        'writer': 'text-purple-800',
        'user': 'text-blue-800'
    };
    const bubbleClasses = roleColors[senderRole] || 'bg-gray-50 border-gray-200';
    const textClass = textColors[senderRole] || 'text-gray-800';
    
    return (
        <div className={`max-w-md p-3 rounded-lg border self-start ${bubbleClasses} shadow-sm`}>
            <div className="flex items-center gap-2 mb-2">
                <p className={`text-xs font-semibold ${textClass}`}>{message.senderName || 'Unknown'}</p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    senderRole === 'writer' ? 'bg-purple-200 text-purple-700' :
                    senderRole === 'admin' ? 'bg-indigo-200 text-indigo-700' :
                    'bg-blue-200 text-blue-700'
                }`}>
                    {senderRole === 'writer' ? 'WRITER' : senderRole === 'admin' ? 'ADMIN' : 'CLIENT'}
                </span>
            </div>
            <p className={`text-sm leading-relaxed ${textClass}`}>{message.text}</p>
            <p className={`text-xs mt-2 text-right ${textClass} opacity-60`}>
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
        </div>
    );
}

const ChatMonitorPage = () => {
    const socket = useSocket();
    const { user } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState([]);
    const [activeChatId, setActiveChatId] = useState(null);
    const [loading, setLoading] = useState({ convos: true, messages: false });
    const [categoryFilter, setCategoryFilter] = useState('all'); // 'all', 'support', 'assignment'
    const [roleFilter, setRoleFilter] = useState('all'); // 'all', 'writer', 'client'
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const chatBodyRef = useRef(null);

    useEffect(() => {
        setLoading(prev => ({ ...prev, convos: true }));
        getConversations().then(response => {
            // Ensure data is properly formatted
            const conversationsData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
            
            // Map and ensure all new fields are present
            const formattedConversations = conversationsData.map(convo => ({
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
            
            setConversations(formattedConversations);
            if (formattedConversations.length > 0 && !activeChatId) {
                setActiveChatId(formattedConversations[0].id);
            }
        }).catch(error => {
            console.error("Failed to fetch conversations", error);
        }).finally(() => {
            setLoading(prev => ({ ...prev, convos: false }));
        });
    }, []);

    useEffect(() => {
        if (!activeChatId) return;
        setLoading(prev => ({ ...prev, messages: true }));
        getChatMessages(activeChatId).then(response => {
            // Format messages to ensure consistent structure with role information
            const formattedMessages = response.data.map(msg => ({
                ...msg,
                id: msg.id || msg._id,
                senderId: msg.senderId || msg.sender?._id || msg.sender?.id,
                senderName: msg.senderName || msg.sender?.name || 'Unknown',
                senderRole: msg.senderRole || msg.sender?.role || 'user',
                text: msg.text || msg.message || '',
                timestamp: msg.timestamp || msg.createdAt || new Date().toISOString(),
            }));
            setMessages(formattedMessages);
        }).catch(error => {
            console.error(`Failed to fetch messages for chat ${activeChatId}`, error);
        }).finally(() => {
            setLoading(prev => ({ ...prev, messages: false }));
        });
    }, [activeChatId]);
    
    // Real-time listeners for admin monitor
    useEffect(() => {
        if (!socket) return;
        
        const handleReceiveMessage = (message) => {
            // Handle messages for current active chat
            if (message.chatId && message.chatId.toString() === activeChatId?.toString()) {
                setMessages(prev => {
                    // Check if message already exists to prevent duplicates
                    const exists = prev.some(m => m.id?.toString() === message.id?.toString());
                    if (exists) return prev;
                    return [...prev, {
                        ...message,
                        senderName: message.senderName || message.sender?.name || 'Unknown',
                        senderRole: message.senderRole || message.sender?.role || 'user',
                    }];
                });
            }
        };

        const handleConversationUpdate = (updatedConvo) => {
            setConversations(prevConvos => {
                const filteredConvos = prevConvos.filter(c => c.id?.toString() !== updatedConvo.id?.toString());
                // Ensure updated conversation has all required fields
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
                return [formattedConvo, ...filteredConvos];
            });
        };

        socket.on('receiveMessage', handleReceiveMessage);
        socket.on('updateConversation', handleConversationUpdate);

        return () => {
            socket.off('receiveMessage', handleReceiveMessage);
            socket.off('updateConversation', handleConversationUpdate);
        };
    }, [socket, activeChatId]);

    useEffect(() => {
        if(chatBodyRef.current) {
            setTimeout(() => {
        if(chatBodyRef.current) {
            chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
                }
            }, 100);
        }
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeChatId || sending) return;

        setSending(true);
        try {
            const response = await postChatMessage(activeChatId, newMessage.trim());
            const sentMessage = response.data;
            
            // Add message to local state immediately for instant feedback
            setMessages(prev => [...prev, {
                ...sentMessage,
                id: sentMessage.id || sentMessage._id,
                senderId: sentMessage.senderId || sentMessage.sender?._id || sentMessage.sender?.id,
                senderName: sentMessage.senderName || sentMessage.sender?.name || user?.name || 'Admin',
                senderRole: sentMessage.senderRole || sentMessage.sender?.role || 'admin',
                text: sentMessage.text || sentMessage.message || newMessage.trim(),
                timestamp: sentMessage.timestamp || sentMessage.createdAt || new Date().toISOString(),
            }]);
            
            setNewMessage('');
            
            // Update conversation list with new last message
            setConversations(prevConvos => {
                return prevConvos.map(convo => {
                    if (convo.id === activeChatId) {
                        return {
                            ...convo,
                            lastMessage: newMessage.trim(),
                            lastMessageSender: user?.name || 'Admin',
                            lastMessageSenderRole: 'admin',
                            lastMessageTime: new Date().toISOString(),
                            isLastMessageFromOther: false,
                        };
                    }
                    return convo;
                });
            });
        } catch (error) {
            console.error('Failed to send message:', error);
            alert(error.response?.data?.message || 'Failed to send message. Please try again.');
        } finally {
            setSending(false);
        }
    };

    const activeConversation = conversations.find(c => c.id === activeChatId);
    
    // Filter conversations based on category and role
    let filteredConversations = conversations;
    
    // Apply category filter
    if (categoryFilter === 'support') {
        filteredConversations = filteredConversations.filter(c => c.isSupportChat);
    } else if (categoryFilter === 'assignment') {
        filteredConversations = filteredConversations.filter(c => c.isAssignmentChat);
    }
    
    // Apply role filter
    if (roleFilter === 'writer') {
        filteredConversations = filteredConversations.filter(c => {
            if (c.isSupportChat) {
                const otherParticipant = c.participants?.find(p => p.role !== 'admin');
                return otherParticipant?.role === 'writer';
            } else if (c.isAssignmentChat) {
                return c.writerName !== null;
            }
            return false;
        });
    } else if (roleFilter === 'client') {
        filteredConversations = filteredConversations.filter(c => {
            if (c.isSupportChat) {
                const otherParticipant = c.participants?.find(p => p.role !== 'admin');
                return otherParticipant?.role === 'user';
            } else if (c.isAssignmentChat) {
                return c.clientName !== null;
            }
            return false;
        });
    }
    
    // Group filtered conversations for display
    const supportChats = filteredConversations.filter(c => c.isSupportChat);
    const assignmentChats = filteredConversations.filter(c => c.isAssignmentChat);
    const unreadCount = filteredConversations.filter(c => c.unreadCount > 0).reduce((sum, c) => sum + c.unreadCount, 0);

    // Helper to get role badge - simplified
    const getRoleBadge = (convo) => {
        if (convo.isSupportChat) {
            const otherParticipant = convo.participants?.find(p => p.role !== 'admin');
            if (otherParticipant) {
                return (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        otherParticipant.role === 'writer' 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-blue-100 text-blue-700'
                    }`}>
                        {otherParticipant.role === 'writer' ? 'WRITER' : 'CLIENT'}
                    </span>
                );
            }
        } else if (convo.isAssignmentChat) {
            // Show both badges for assignment chats
            return (
                <div className="flex gap-1">
                    {convo.clientName && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                            CLIENT
                        </span>
                    )}
                    {convo.writerName && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                            WRITER
                        </span>
                    )}
                </div>
            );
        }
        return null;
    };

    // Helper to get conversation display info
    const getConversationInfo = (convo) => {
        if (convo.isSupportChat) {
            const otherParticipant = convo.participants?.find(p => p.role !== 'admin');
            return {
                title: otherParticipant?.name || 'User',
                subtitle: 'Support Chat',
                showSender: convo.isLastMessageFromOther && convo.lastMessageSender,
                senderRole: convo.lastMessageSenderRole
            };
        } else if (convo.isAssignmentChat) {
            return {
                title: convo.assignmentTitle || convo.name,
                subtitle: `${convo.clientName || 'Client'} & ${convo.writerName || 'Writer'}`,
                showSender: convo.isLastMessageFromOther && convo.lastMessageSender,
                senderRole: convo.lastMessageSenderRole
            };
        }
        return { title: convo.name, subtitle: '', showSender: false, senderRole: null };
    };

    const renderConversationItem = (convo) => {
        const info = getConversationInfo(convo);
        const hasUnread = convo.unreadCount > 0;
        const isNewMessage = convo.isLastMessageFromOther && hasUnread;
        
        // Get role for color coding
        const otherParticipant = convo.participants?.find(p => p.role !== 'admin');
        const roleColor = otherParticipant?.role === 'writer' ? 'purple' : otherParticipant?.role === 'user' ? 'blue' : 'gray';

        return (
            <div
                key={convo.id}
                onClick={() => setActiveChatId(convo.id)}
                className={`flex items-center p-3 cursor-pointer transition-all border-l-4 ${
                    activeChatId === convo.id 
                        ? 'bg-indigo-50 border-indigo-600' 
                        : isNewMessage
                        ? 'bg-blue-50 border-blue-400'
                        : 'bg-white border-transparent hover:bg-gray-50'
                }`}
            >
                <div className="relative flex-shrink-0">
                    <Avatar user={convo} className="w-12 h-12" />
                    {hasUnread && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                            {convo.unreadCount > 9 ? '9+' : convo.unreadCount}
                        </span>
                    )}
                </div>
                <div className="flex-grow overflow-hidden min-w-0 ml-3">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 flex-grow min-w-0">
                            <h3 className={`font-semibold truncate text-sm ${hasUnread ? 'text-indigo-700' : 'text-gray-900'}`}>
                                {info.title}
                            </h3>
                            {getRoleBadge(convo)}
                        </div>
                        {convo.lastMessageTime && (
                            <span className={`text-xs flex-shrink-0 ml-2 ${hasUnread ? 'text-indigo-600 font-semibold' : 'text-gray-500'}`}>
                                {new Date(convo.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                    </div>
                    {info.subtitle && (
                        <p className="text-xs text-gray-500 truncate mb-1">{info.subtitle}</p>
                    )}
                    <div className="flex items-center gap-1.5">
                        {info.showSender && info.senderRole && (
                            <span className={`text-xs font-semibold ${
                                info.senderRole === 'writer' ? 'text-purple-600' : 
                                info.senderRole === 'user' ? 'text-blue-600' : 
                                'text-gray-600'
                            }`}>
                                {info.senderRole === 'writer' ? 'Writer' : info.senderRole === 'user' ? 'Client' : 'Admin'}:
                            </span>
                        )}
                        <p className={`text-xs truncate ${hasUnread ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                            {convo.lastMessage || 'No messages yet'}
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-[calc(100vh-10rem)] bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="w-1/3 border-r border-gray-200 flex flex-col bg-gray-50">
                <div className="p-4 border-b border-gray-200 bg-white">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-800">Conversations</h2>
                        {unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                                {unreadCount}
                            </span>
                        )}
                    </div>
                    
                    {/* Simplified Filter Dropdowns */}
                    <div className="flex gap-2 mb-3">
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                            <option value="all">All Categories</option>
                            <option value="support">Support Chats</option>
                            <option value="assignment">Assignment Chats</option>
                        </select>
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                            <option value="all">All Roles</option>
                            <option value="writer">Writers Only</option>
                            <option value="client">Clients Only</option>
                        </select>
                    </div>
                    
                    {conversations.length > 0 && (
                        <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                            Showing <span className="font-semibold text-gray-700">{filteredConversations.length}</span> of <span className="font-semibold text-gray-700">{conversations.length}</span> conversations
                        </div>
                    )}
                </div>
                <div className="flex-grow overflow-y-auto">
                    {loading.convos ? (
                        <div className="p-4 text-center text-gray-500">Loading chats...</div>
                    ) : filteredConversations.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                            {conversations.length === 0 ? (
                                'No conversations yet'
                            ) : (
                                <div>
                                    <p className="text-sm font-medium text-gray-700 mb-1">No conversations match your filters</p>
                                    <button
                                        onClick={() => {
                                            setCategoryFilter('all');
                                            setRoleFilter('all');
                                        }}
                                        className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                                    >
                                        Clear filters
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div>
                            {supportChats.length > 0 && (categoryFilter === 'all' || categoryFilter === 'support') && (
                                <div className="mb-1">
                                    {categoryFilter === 'all' && (
                                        <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
                                            <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                                                Support Chats ({supportChats.length})
                                            </h3>
                                        </div>
                                    )}
                                    {supportChats.map(renderConversationItem)}
                                </div>
                            )}
                            {assignmentChats.length > 0 && (categoryFilter === 'all' || categoryFilter === 'assignment') && (
                                <div>
                                    {categoryFilter === 'all' && (
                                        <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 border-t border-gray-200 sticky top-0 z-10">
                                            <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                                                Assignment Chats ({assignmentChats.length})
                                            </h3>
                                </div>
                                    )}
                                    {assignmentChats.map(renderConversationItem)}
                            </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="w-2/3 flex flex-col">
                {activeConversation ? (
                    <>
                        <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Avatar user={activeConversation} className="w-10 h-10" />
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-800 truncate">
                                        {activeConversation.isAssignmentChat ? (activeConversation.assignmentTitle || activeConversation.name) : activeConversation.name}
                                    </h2>
                                    {activeConversation.isAssignmentChat && (
                                        <p className="text-xs text-gray-500">
                                            {activeConversation.clientName && <span className="text-blue-600 font-medium">Client: {activeConversation.clientName}</span>}
                                            {activeConversation.clientName && activeConversation.writerName && <span className="mx-2">•</span>}
                                            {activeConversation.writerName && <span className="text-purple-600 font-medium">Writer: {activeConversation.writerName}</span>}
                                        </p>
                                    )}
                                    {activeConversation.isSupportChat && (
                                        <p className="text-xs text-gray-500">
                                            Support Chat
                                            {activeConversation.participants?.find(p => p.role !== 'admin') && (
                                                <span className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold ${
                                                    activeConversation.participants.find(p => p.role !== 'admin')?.role === 'writer' 
                                                        ? 'bg-purple-100 text-purple-700' 
                                                        : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {activeConversation.participants.find(p => p.role !== 'admin')?.role === 'writer' ? 'WRITER' : 'CLIENT'}
                                                </span>
                                            )}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div ref={chatBodyRef} className="flex-grow p-6 overflow-y-auto bg-gradient-to-b from-gray-50 via-white to-gray-50 flex flex-col space-y-3">
                             {loading.messages ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                        <div className="text-gray-500 text-sm">Loading messages...</div>
                                    </div>
                                </div>
                             ) : messages.length === 0 ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center text-gray-500">
                                        <p className="text-lg font-medium mb-2">No messages yet</p>
                                        <p className="text-sm">Start the conversation!</p>
                                    </div>
                        </div>
                             ) : (
                                messages.map(msg => <ChatMessageBubble key={msg.id || msg._id} message={msg} />)
                             )}
                        </div>
                        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200">
                            <div className="flex items-center space-x-4">
                                <button 
                                    type="button" 
                                    className="text-gray-500 hover:text-gray-700 transition-colors"
                                    title="Attach file (coming soon)"
                                >
                                    <PaperClipIcon className="w-6 h-6" />
                                </button>
                                <input
                                    type="text"
                                    placeholder="Type your message..."
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    className="flex-grow px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    disabled={sending}
                                />
                                <button 
                                    type="submit" 
                                    disabled={!newMessage.trim() || sending}
                                    className={`rounded-full p-2 transition-all ${
                                        newMessage.trim() && !sending
                                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer'
                                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    }`}
                                >
                                    {sending ? (
                                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                    <SendIcon className="w-6 h-6" />
                                    )}
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <div className="flex-grow flex items-center justify-center text-gray-500">
                        {loading.convos ? <p>Loading...</p> : <p>Select a conversation to monitor.</p>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatMonitorPage;
