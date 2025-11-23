import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, ChatConversation } from '../../types';
import SendIcon from '../icons/SendIcon';
import PaperClipIcon from '../icons/PaperClipIcon';
import { getConversations, getChatMessages, postChatMessage } from '../../services/api';
import Avatar from '../shared/Avatar';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';

const ChatMessageBubble: React.FC<{ message: ChatMessage; isOwn: boolean }> = ({ message, isOwn }) => {
    const bubbleClasses = isOwn ? 'bg-indigo-500 text-white self-end' : 'bg-gray-200 text-gray-800 self-start';
    return (
        <div className={`max-w-md p-3 rounded-lg ${bubbleClasses}`}>
            {!isOwn && <p className="text-xs font-semibold opacity-80 mb-1">{message.senderName || message.sender?.name || 'User'}</p>}
            <p className="text-sm">{message.text}</p>
            <p className={`text-xs mt-1 ${isOwn ? 'text-right' : 'text-right'} opacity-75`}>
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
        </div>
    );
}

const ChatMonitorPage: React.FC = () => {
    const { user } = useAuth();
    const socket = useSocket();
    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState({ convos: true, messages: false });
    const chatBodyRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLoading(prev => ({ ...prev, convos: true }));
        getConversations().then(response => {
            setConversations(response.data);
            if (response.data.length > 0 && !activeChatId) {
                setActiveChatId(response.data[0].id);
            }
        }).catch(error => {
            console.error("Failed to fetch conversations", error);
        }).finally(() => {
            setLoading(prev => ({ ...prev, convos: false }));
        });
    }, [activeChatId]);

    useEffect(() => {
        if (!activeChatId) return;
        setLoading(prev => ({ ...prev, messages: true }));
        getChatMessages(activeChatId).then(response => {
            setMessages(response.data);
        }).catch(error => {
            console.error(`Failed to fetch messages for chat ${activeChatId}`, error);
        }).finally(() => {
            setLoading(prev => ({ ...prev, messages: false }));
        });
    }, [activeChatId]);
    
    // Real-time listeners for admin monitor
    useEffect(() => {
        if (!socket || !user) return;
        
        const handleReceiveMessage = (message: ChatMessage) => {
            if (message.chatId === activeChatId) {
                setMessages(prev => {
                    // Avoid duplicates
                    const exists = prev.some(m => m.id === message.id || (m._id && m._id === message.id));
                    if (exists) return prev;
                    return [...prev, message];
                });
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
    }, [socket, activeChatId, user]);

    useEffect(() => {
        if(chatBodyRef.current) {
            chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim() === '' || !user || !activeChatId) return;
        
        try {
            const sentMessage = await postChatMessage(activeChatId, newMessage);
            // Add the sent message to the list
            const messageData = sentMessage.data || sentMessage;
            setMessages(prev => {
                // Avoid duplicates
                const exists = prev.some(m => m.id === messageData.id || (m._id && m._id === messageData.id));
                if (exists) return prev;
                return [...prev, messageData];
            });
            setNewMessage('');
            setErrorMessage(null);
        } catch (error: any) {
            console.error('Failed to send message', error);
            setErrorMessage(error.response?.data?.message || error.message || 'Failed to send message');
            setTimeout(() => setErrorMessage(null), 5000);
        }
    };

    const activeConversation = conversations.find(c => c.id === activeChatId);

    return (
        <div className="flex h-[calc(100vh-10rem)] bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="w-1/3 border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800">All Conversations</h2>
                </div>
                <div className="flex-grow overflow-y-auto">
                    {loading.convos ? <p className="p-4">Loading chats...</p> : conversations.map(convo => (
                        <div key={convo.id} onClick={() => setActiveChatId(convo.id)} className={`flex items-center p-4 cursor-pointer hover:bg-gray-50 ${activeChatId === convo.id ? 'bg-indigo-50 border-r-4 border-indigo-500' : ''}`}>
                            <Avatar user={convo} className="w-12 h-12 mr-4" />
                            <div className="flex-grow overflow-hidden">
                                <div className="flex justify-between">
                                    <h3 className="font-semibold text-gray-800 truncate" title={convo.name}>{convo.name}</h3>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className="text-sm text-gray-600 truncate">{convo.lastMessage}</p>
                                    <p className="text-xs text-gray-500 flex-shrink-0">{convo.timestamp}</p>
                                </div>
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
                             {loading.messages ? (
                                 <p className="text-center text-gray-500">Loading messages...</p>
                             ) : messages.length === 0 ? (
                                 <p className="text-center text-gray-500">No messages yet. Start the conversation!</p>
                             ) : (
                                 messages.map(msg => {
                                     const isOwn = user && (
                                         (msg.senderId && msg.senderId.toString() === user.id?.toString()) ||
                                         (msg.sender?._id && msg.sender._id.toString() === user.id?.toString()) ||
                                         (msg.isOwnMessage === true)
                                     );
                                     return <ChatMessageBubble key={msg.id || msg._id || Math.random()} message={msg} isOwn={isOwn} />;
                                 })
                             )}
                        </div>
                        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200">
                            {errorMessage && (
                                <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                                    {errorMessage}
                                </div>
                            )}
                            <div className="flex items-center space-x-4">
                                <button type="button" className="text-gray-500 hover:text-gray-700">
                                    <PaperClipIcon className="w-6 h-6" />
                                </button>
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-grow px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <button type="submit" className="bg-indigo-600 text-white rounded-full p-2 hover:bg-indigo-700 transition-colors">
                                    <SendIcon className="w-6 h-6" />
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