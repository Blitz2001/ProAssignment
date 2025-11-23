import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, ChatConversation } from '../../types';
import SendIcon from '../icons/SendIcon';
import PaperClipIcon from '../icons/PaperClipIcon';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { getConversations, getChatMessages, postChatMessage } from '../../services/api';
import { validateNoContactInfo } from '../../utils/contactValidation';
import Avatar from './Avatar';

const ChatBubble: React.FC<{ message: ChatMessage; isOwn: boolean }> = ({ message, isOwn }) => {
    const bubbleClasses = isOwn ? 'bg-indigo-500 text-white self-end' : 'bg-gray-200 text-gray-800 self-start';
    return (
        <div className={`max-w-md p-3 rounded-lg ${bubbleClasses}`}>
            <p className="text-sm">{message.text}</p>
            <p className="text-xs mt-1 text-right opacity-75">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
    );
};

const ChatPage: React.FC = () => {
    const { user } = useAuth();
    const socket = useSocket();
    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const chatBodyRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState({ convos: true, messages: false });

    useEffect(() => {
        if (!user) return;
        setLoading(prev => ({ ...prev, convos: true }));
        getConversations().then(res => {
            setConversations(res.data);
            if(res.data.length > 0 && !activeChatId) {
                setActiveChatId(res.data[0].id);
            }
        }).finally(() => setLoading(prev => ({ ...prev, convos: false })));
    }, [user, activeChatId]);

    useEffect(() => {
        if (!activeChatId) return;
        setLoading(prev => ({ ...prev, messages: true }));
        getChatMessages(activeChatId).then(res => setMessages(res.data))
        .finally(() => setLoading(prev => ({ ...prev, messages: false })));
    }, [activeChatId]);

    // Real-time listeners
    useEffect(() => {
        if (!socket) return;

        const handleReceiveMessage = (message: ChatMessage) => {
            if (message.chatId === activeChatId) {
                setMessages(prev => [...prev, message]);
            }
        };

        const handleConversationUpdate = (updatedConvo: ChatConversation) => {
            setConversations(prevConvos => {
                const filteredConvos = prevConvos.filter(c => c.id !== updatedConvo.id);
                return [updatedConvo, ...filteredConvos];
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
        if (chatBodyRef.current) {
            chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim() === '' || !user || !activeChatId) return;
        
        // ALWAYS validate for contact information if user is client or writer
        // Block contact info sharing between clients and writers (admin chats are exception)
        if (user.role === 'user' || user.role === 'writer') {
            const activeConversation = conversations.find(c => c.id === activeChatId);
            
            // Admin support chats are the ONLY exception where contact info is allowed
            // Admin chats are named "Admin Support" or contain both "admin" and "support"
            const isAdminChat = activeConversation && 
                (activeConversation.name === 'Admin Support' ||
                 (activeConversation.name.toLowerCase().includes('admin') && activeConversation.name.toLowerCase().includes('support')));
            
            // For client-writer chats (NOT admin), ALWAYS validate and block
            if (!isAdminChat) {
                const validation = validateNoContactInfo(newMessage.trim());
                console.log('Contact validation:', { message: newMessage, validation, isAdminChat, conversationName: activeConversation?.name });
                if (!validation.isValid) {
                    console.log('BLOCKING MESSAGE - Contact info detected!');
                    setErrorMessage(validation.errorMessage || 'This message contains restricted information.');
                    setTimeout(() => setErrorMessage(null), 8000);
                    return; // CRITICAL: Stop here, don't send message
                }
            }
        }

        try {
            const sentMessage = await postChatMessage(activeChatId, newMessage);
            setMessages(prev => [...prev, sentMessage.data]);
            setNewMessage('');
            setErrorMessage(null);
        } catch (error: any) {
            console.error("Failed to send message", error);
            // Handle backend validation errors
            const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to send message.';
            setErrorMessage(errorMsg);
            setTimeout(() => setErrorMessage(null), 8000);
        }
    };
    
    const activeConversation = conversations.find(c => c.id === activeChatId);

    return (
        <div className="flex h-[calc(100vh-10rem)] bg-white rounded-lg shadow-sm border border-gray-200">
             <div className="w-1/3 border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800">Your Chats</h2>
                </div>
                <div className="flex-grow overflow-y-auto">
                    {loading.convos ? <p className="p-4 text-gray-500">Loading conversations...</p> : conversations.map(convo => (
                        <div key={convo.id} onClick={() => setActiveChatId(convo.id)} className={`flex items-center p-4 cursor-pointer hover:bg-gray-50 ${activeChatId === convo.id ? 'bg-indigo-50' : ''}`}>
                             <Avatar user={convo} className="w-12 h-12 mr-4 flex-shrink-0" />
                             <div className="flex-grow overflow-hidden">
                                 <h3 className="font-semibold text-gray-800 truncate">{convo.name}</h3>
                                 <p className="text-sm text-gray-600 truncate">{convo.lastMessage}</p>
                             </div>
                        </div>
                    ))}
                </div>
            </div>
             <div className="w-2/3 flex flex-col">
                 {activeConversation ? (
                    <>
                        <div className="p-4 border-b border-gray-200 flex items-center">
                             <Avatar user={activeConversation} className="w-10 h-10 mr-3" />
                             <h2 className="text-lg font-semibold text-gray-800 truncate">{activeConversation.name}</h2>
                        </div>
                        <div ref={chatBodyRef} className="flex-grow p-6 overflow-y-auto bg-gray-50 flex flex-col space-y-4">
                            {loading.messages ? <p className="text-gray-500">Loading messages...</p> : messages.map(msg => <ChatBubble key={msg.id} message={msg} isOwn={msg.senderId === user?.id} />)}
                        </div>
                        <div className="p-4 bg-white border-t border-gray-200">
                            {errorMessage && (
                                <div className="mb-3 p-3 bg-red-100 border-2 border-red-400 rounded-lg shadow-md">
                                    <p className="text-sm font-semibold text-red-900">{errorMessage}</p>
                                </div>
                            )}
                            <form onSubmit={handleSendMessage} className="flex items-center space-x-4">
                                <button type="button" className="text-gray-500 hover:text-indigo-500">
                                    <PaperClipIcon className="w-6 h-6" />
                                </button>
                                <input
                                    type="text"
                                    placeholder="Type your message..."
                                    value={newMessage}
                                    onChange={e => {
                                        setNewMessage(e.target.value);
                                        if (errorMessage) setErrorMessage(null);
                                    }}
                                    className="flex-grow px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                <button type="submit" className="bg-indigo-600 text-white rounded-full p-2 hover:bg-indigo-700">
                                    <SendIcon className="w-6 h-6" />
                                </button>
                            </form>
                        </div>
                    </>
                 ) : (
                    <div className="flex-grow flex items-center justify-center text-gray-500">
                        {loading.convos ? <p>Loading conversations...</p> : <p>Select a conversation to start chatting.</p>}
                    </div>
                 )}
            </div>
        </div>
    );
};

export default ChatPage;