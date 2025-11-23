import asyncHandler from 'express-async-handler';
import { Conversation, Message } from '../models/chatModel.js';
import Notification from '../models/notificationModel.js';
import User from '../models/userModel.js';
import validateNoContactInfo from '../utils/contactValidation.js';

// Helper: normalize a possible mongoose doc/ObjectId/string to plain id string
const recipientIdDocId = (idLike) => {
    if (!idLike) return null;
    if (typeof idLike === 'string') return idLike;
    if (idLike._id) {
        return idLike._id.toString ? idLike._id.toString() : String(idLike._id);
    }
    return idLike.toString ? idLike.toString() : String(idLike);
};

const emitSocketEvent = (req, recipientId, event, data) => {
    try {
        if (!req || !req.activeUsers || !req.io) {
            console.warn('Socket not available for event emission');
            return;
        }
        const recipientSocketId = req.activeUsers.get(recipientId?.toString());
        if (recipientSocketId) {
            req.io.to(recipientSocketId).emit(event, data);
        }
    } catch (error) {
        console.error('Error emitting socket event:', error);
        // Don't throw - this is non-critical
    }
};

// Helper to calculate unread count for a conversation
const calculateUnreadCount = async (conversationId, userId) => {
    try {
        const conversation = await Conversation.findById(conversationId).select('lastViewedBy lastMessage');
        if (!conversation) return 0;
        
        const userIdStr = userId.toString();
        const lastViewedValue = conversation.lastViewedBy?.[userIdStr];
        let lastViewedAt = null;
        
        if (lastViewedValue) {
            // Handle both ISO string and Date object
            lastViewedAt = lastViewedValue instanceof Date ? lastViewedValue : new Date(lastViewedValue);
            // Validate the date
            if (isNaN(lastViewedAt.getTime())) {
                lastViewedAt = null;
            }
        }
        
        if (!lastViewedAt) {
            // If never viewed, count all messages not sent by user
            const count = await Message.countDocuments({
                conversation: conversationId,
                sender: { $ne: userId }
            });
            return count;
        }
        
        // Count messages after last viewed time that weren't sent by user
        const count = await Message.countDocuments({
            conversation: conversationId,
            createdAt: { $gt: lastViewedAt },
            sender: { $ne: userId }
        });
        
        return count;
    } catch (error) {
        console.error('Error calculating unread count:', error);
        return 0;
    }
};

const formatConversationForUser = async (c, userId, isAdmin = false) => {
    let chatName;
    let avatar;
    const otherParticipant = c.participants.find(p => p._id.toString() !== userId.toString());
    const client = c.participants.find(p => p.role === 'user');
    const writer = c.participants.find(p => p.role === 'writer');
    const adminParticipant = c.participants.find(p => p.role === 'admin');

    if (!c.assignment) {
        // Support Chat
        if (isAdmin) {
            chatName = otherParticipant ? otherParticipant.name : 'User';
            avatar = otherParticipant ? otherParticipant.avatar : null;
        } else { // Writer or User
            chatName = 'Admin Support';
            avatar = adminParticipant ? adminParticipant.avatar : null;
        }
    } else {
        // Assignment Chat
        if (isAdmin) {
            const title = c.assignment.title.length > 20 ? `${c.assignment.title.substring(0, 20)}...` : c.assignment.title;
            chatName = title;
            avatar = client ? client.avatar : (writer ? writer.avatar : null);
        } else {
            chatName = otherParticipant ? otherParticipant.name : 'Chat';
            avatar = otherParticipant ? otherParticipant.avatar : null;
        }
    }

    // Determine conversation type and last message sender info
    const lastMessageSender = c.lastMessage?.sender;
    const isLastMessageFromOther = lastMessageSender && lastMessageSender._id && lastMessageSender._id.toString() !== userId.toString();
    const lastMessageSenderRole = lastMessageSender?.role || (lastMessageSender ? 'user' : null);

    // Calculate unread count
    const unreadCount = await calculateUnreadCount(c._id, userId);

    return {
        id: c._id?.toString() || c._id,
        name: chatName,
        avatar: avatar,
        lastMessage: c.lastMessage ? c.lastMessage.text : 'Start a conversation!',
        lastMessageSender: lastMessageSender ? lastMessageSender.name : null,
        lastMessageSenderRole: lastMessageSenderRole,
        isLastMessageFromOther: isLastMessageFromOther,
        timestamp: c.lastMessage ? new Date(c.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        lastMessageTime: c.lastMessage ? c.lastMessage.createdAt : null,
        unread: unreadCount,
        unreadCount: unreadCount,
        participants: c.participants.map(p => ({
            id: p._id?.toString() || p.id?.toString() || p.toString(),
            name: p.name || 'Unknown',
            role: p.role || 'user',
            avatar: p.avatar || null
        })),
        assignmentId: c.assignment ? (c.assignment._id?.toString() || c.assignment._id) : null,
        assignmentTitle: c.assignment ? (c.assignment.title || '') : null,
        isSupportChat: !c.assignment,
        isAssignmentChat: !!c.assignment,
        clientName: client ? client.name : null,
        writerName: writer ? writer.name : null,
        adminName: adminParticipant ? adminParticipant.name : null,
    };
};

// @desc    Get conversations for a user
// @route   GET /api/chats/conversations
// @access  Private
const getConversations = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const isAdmin = req.user.role === 'admin';
    
    // If user is a writer or user, ensure an admin chat exists
    let adminChatCreated = false;
    let adminChatId = null;
    let adminUser = null;
    if (req.user.role === 'writer' || req.user.role === 'user') {
        adminUser = await User.findOne({ role: 'admin' });
        if (!adminUser) {
            console.error('Chat: ❌ CRITICAL ERROR: No admin user found in database!');
            console.error('Chat: Admin chat cannot be created without an admin user.');
            console.error('Chat: Solution: Create an admin user using one of these methods:');
            console.error('Chat:   1. npm run seed:admin (in backend directory)');
            console.error('Chat:   2. npm run seed:production (in backend directory)');
            console.error('Chat:   3. Register a user and manually set role to "admin" in database');
            // Continue anyway - we'll try to handle it gracefully
        } else {
            console.log(`Chat: Admin user found: ${adminUser._id} (${adminUser.name || adminUser.email})`);
            // Find or create a conversation with no assignment attached
            try {
                const adminChat = await Conversation.findOneAndUpdate(
                    { 
                        participants: { $all: [userId, adminUser._id], $size: 2 },
                        assignment: { $exists: false }
                    },
                    { 
                        $setOnInsert: { 
                            participants: [userId, adminUser._id],
                        } 
                    },
                    { upsert: true, new: true }
                );
                adminChatCreated = !!adminChat;
                adminChatId = adminChat ? adminChat._id.toString() : null;
                console.log(`Chat: Admin chat ${adminChatCreated ? '✅ created/found' : '❌ failed'} for user ${userId}`, adminChatId);
            } catch (chatError) {
                console.error('Chat: ❌ Error creating/finding admin chat:', chatError);
                adminChatCreated = false;
            }
        }
    }

    // Query for conversations - ensure we include the newly created admin chat
    // For non-admin users, find conversations where userId is in participants array
    // Use $in to properly match ObjectId in array
    let conversations = [];
    
    if (isAdmin) {
        // Admin sees all conversations
        conversations = await Conversation.find({})
            .populate('participants', 'name avatar role')
            .populate('assignment', 'title')
            .populate({
                path: 'lastMessage',
                populate: { path: 'sender', select: 'name role' }
            })
            .sort({ 'updatedAt': -1 });
    } else {
        // Regular users see only their conversations
        // This includes:
        // 1. Admin support chat (no assignment field) - ALWAYS available
        // 2. Assignment chats (has assignment field) - Only when writer is assigned
        
        // Use $in to properly match ObjectId in array - try multiple query formats to ensure we find conversations
        // First try with $in operator
        let query1 = await Conversation.find({ participants: { $in: [userId] } })
            .populate('participants', 'name avatar role')
            .populate('assignment', 'title')
            .populate({
                path: 'lastMessage',
                populate: { path: 'sender', select: 'name role' }
            })
            .sort({ 'updatedAt': -1 });
        
        // Also try direct match (in case MongoDB version handles it differently)
        let query2 = await Conversation.find({ participants: userId })
            .populate('participants', 'name avatar role')
            .populate('assignment', 'title')
            .populate({
                path: 'lastMessage',
                populate: { path: 'sender', select: 'name role' }
            })
            .sort({ 'updatedAt': -1 });
        
        // Use the query that returns more results
        conversations = query1.length >= query2.length ? query1 : query2;
        console.log(`Chat: Query results - $in: ${query1.length}, direct: ${query2.length}, using: ${conversations.length}`);
        
        // For clients, ensure admin chat is always first (support chat)
        // Assignment chats will appear after writer is assigned
        conversations = conversations.sort((a, b) => {
            // Admin support chats (no assignment) come first
            if (!a.assignment && b.assignment) return -1;
            if (a.assignment && !b.assignment) return 1;
            // Then sort by updatedAt
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });
    }
    
    console.log(`Chat: Query found ${conversations.length} conversations before adding admin chat`);
    
    // ALWAYS ensure admin chat is in results if it was created
    if (adminChatCreated && adminChatId) {
        const chatInResults = conversations.some(c => c._id.toString() === adminChatId.toString());
        if (!chatInResults) {
            console.log('Chat: Admin chat created but not in query results, fetching directly...');
            const directChat = await Conversation.findById(adminChatId)
                .populate('participants', 'name avatar role')
                .populate('assignment', 'title')
                .populate({
                    path: 'lastMessage',
                    populate: { path: 'sender', select: 'name role' }
                });
            if (directChat) {
                conversations.unshift(directChat); // Add to beginning
                console.log('Chat: ✅ Successfully added admin chat to results');
            } else {
                console.error('Chat: ❌ Failed to fetch admin chat directly by ID:', adminChatId);
                // Try one more time with a fresh query
                console.log('Chat: Retrying admin chat query...');
                if (adminUser) {
                    const retryChat = await Conversation.findOne({
                        participants: { $all: [userId, adminUser._id], $size: 2 },
                        assignment: { $exists: false }
                    })
                .populate('participants', 'name avatar role')
                .populate('assignment', 'title')
                .populate({
                    path: 'lastMessage',
                    populate: { path: 'sender', select: 'name role' }
                });
                    if (retryChat) {
                        conversations.unshift(retryChat);
                        console.log('Chat: ✅ Successfully found admin chat on retry');
                    } else {
                        console.error('Chat: ❌ Admin chat still not found after retry');
                    }
                }
            }
        } else {
            console.log('Chat: ✅ Admin chat already in results');
        }
    } else if ((req.user.role === 'writer' || req.user.role === 'user') && conversations.length === 0) {
        console.warn('Chat: ⚠️ No conversations found for user, attempting to create admin chat...');
        // Try to find admin chat anyway
        if (!adminUser) {
            adminUser = await User.findOne({ role: 'admin' });
            if (!adminUser) {
                console.error('Chat: ❌ CRITICAL: No admin user exists in database! Admin chat cannot be created.');
                console.error('Chat: Please create an admin user using: npm run seed:admin or the admin seed script');
            }
        }
        if (adminUser) {
            console.log('Chat: Admin user found, attempting to find or create admin chat...');
            const existingAdminChat = await Conversation.findOne({
                participants: { $all: [userId, adminUser._id], $size: 2 },
                assignment: { $exists: false }
            })
            .populate('participants', 'name avatar role')
            .populate('assignment', 'title')
            .populate({
                path: 'lastMessage',
                populate: { path: 'sender', select: 'name role' }
            });
            if (existingAdminChat) {
                conversations.unshift(existingAdminChat);
                console.log('Chat: ✅ Found existing admin chat');
            } else {
                // If still not found, create it now
                console.log('Chat: Creating admin chat now...');
                try {
                    const newAdminChat = await Conversation.create({
                        participants: [userId, adminUser._id]
                    });
                    const populatedChat = await Conversation.findById(newAdminChat._id)
                        .populate('participants', 'name avatar role')
                        .populate('assignment', 'title')
                        .populate({
                            path: 'lastMessage',
                            populate: { path: 'sender', select: 'name role' }
                        });
                    if (populatedChat) {
                        conversations.unshift(populatedChat);
                        console.log('Chat: ✅ Created and added admin chat');
                    } else {
                        console.error('Chat: ❌ Failed to populate newly created admin chat');
                    }
                } catch (createError) {
                    console.error('Chat: ❌ Error creating admin chat:', createError);
                }
            }
        } else {
            console.error('Chat: ❌ Cannot create admin chat - no admin user in database');
        }
    }
    
    console.log(`Chat: Found ${conversations.length} conversations for user ${userId} (role: ${req.user.role})`);
    
    // Remove duplicates based on conversation ID
    const uniqueConversations = [];
    const seenIds = new Set();
    for (const conv of conversations) {
        const convId = conv._id.toString();
        if (!seenIds.has(convId)) {
            seenIds.add(convId);
            uniqueConversations.push(conv);
        }
    }
    
    // CRITICAL: If admin chat was created but not in results, add it now
    if (adminChatCreated && adminChatId && !isAdmin) {
        const adminChatInResults = uniqueConversations.some(c => c._id.toString() === adminChatId.toString());
        if (!adminChatInResults) {
            console.log('Chat: ⚠️ Admin chat created but missing from results, fetching one more time...');
            try {
                const missingChat = await Conversation.findById(adminChatId)
                    .populate('participants', 'name avatar role')
                    .populate('assignment', 'title')
                    .populate({
                        path: 'lastMessage',
                        populate: { path: 'sender', select: 'name role' }
                    });
                if (missingChat) {
                    uniqueConversations.unshift(missingChat);
                    console.log('Chat: ✅ Added missing admin chat to results');
                }
            } catch (fetchError) {
                console.error('Chat: ❌ Failed to fetch missing admin chat:', fetchError);
            }
        }
    }
    
    // Final sort: Admin support chats first, then assignment chats (by updatedAt)
    if (!isAdmin) {
        uniqueConversations.sort((a, b) => {
            // Admin support chats (no assignment) come first
            if (!a.assignment && b.assignment) return -1;
            if (a.assignment && !b.assignment) return 1;
            // Then sort by updatedAt (most recent first)
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });
    }
    
    const formatted = await Promise.all(
        uniqueConversations.map(c => formatConversationForUser(c, userId, isAdmin))
    );
    
    console.log(`Chat: Returning ${formatted.length} formatted conversations`);
    console.log('Chat: Conversation names:', formatted.map(c => c.name));
    console.log('Chat: Conversation types:', formatted.map(c => ({
        name: c.name,
        isSupportChat: c.isSupportChat,
        isAssignmentChat: c.isAssignmentChat,
        assignmentId: c.assignmentId
    })));
    
    // Final check: If user is client and no admin chat in formatted results, log warning
    if (!isAdmin && formatted.length > 0) {
        const hasAdminChat = formatted.some(c => c.isSupportChat);
        if (!hasAdminChat) {
            console.warn('Chat: ⚠️ WARNING: Client user has conversations but no admin support chat!');
            console.warn('Chat: This may indicate an issue with admin chat creation or admin user missing.');
        }
    }
    
    res.json(formatted);
});

// @desc    Get messages for a conversation
// @route   GET /api/chats/:conversationId/messages
// @access  Private
const getMessages = asyncHandler(async (req, res) => {
    const conversationId = req.params.conversationId;
    const userId = req.user._id;
    console.log(`📨 Chat: Fetching messages for conversation ${conversationId}`);
    
    const messages = await Message.find({ conversation: conversationId })
        .populate('sender', 'name role')
        .sort({ createdAt: 1 }); // Sort by creation time ascending (oldest first)
    
    console.log(`📨 Chat: Found ${messages.length} messages for conversation ${conversationId}`);

    const formatted = messages.map(m => {
        const formattedMsg = {
            id: m._id.toString(),
            _id: m._id.toString(),
            chatId: m.conversation?.toString() || conversationId,
            conversation: m.conversation?.toString() || conversationId,
            text: m.text || '',
            message: m.text || '', // Also include as 'message' for compatibility
            timestamp: m.createdAt,
            createdAt: m.createdAt,
            isOwnMessage: m.sender && m.sender._id.toString() === req.user._id.toString(),
            senderName: m.sender?.name || 'Unknown',
            senderId: m.sender?._id?.toString() || null,
            senderRole: m.sender?.role || 'user',
            sender: m.sender ? {
                _id: m.sender._id.toString(),
                name: m.sender.name,
                role: m.sender.role || 'user'
            } : null
        };
        return formattedMsg;
    });
    
    // Mark conversation as viewed when messages are fetched
    try {
        const conversation = await Conversation.findById(conversationId).populate('assignment');
        if (conversation) {
            if (!conversation.lastViewedBy) {
                conversation.lastViewedBy = {};
            }
            const now = new Date();
            conversation.lastViewedBy[userId.toString()] = now.toISOString();
            conversation.markModified('lastViewedBy'); // Important: mark as modified for Mixed type
            await conversation.save();
            
            console.log(`📨 Chat: Marked conversation ${conversationId} as viewed by user ${userId.toString()} at ${now.toISOString()}`);
            
            // Emit specific event with assignment ID for immediate update
            if (conversation.assignment) {
                const assignmentId = conversation.assignment._id ? conversation.assignment._id.toString() : conversation.assignment.toString();
                
                // Emit via socket helper
                emitSocketEvent(req, userId.toString(), 'assignmentUnreadUpdated', { 
                    assignmentId: assignmentId, 
                    unreadCount: 0 
                });
                console.log(`📨 Chat: Emitted assignmentUnreadUpdated socket event for assignment ${assignmentId} (getMessages)`);
                
                // Also broadcast directly to all sockets of this user (for immediate cross-tab updates)
                if (req.io && req.activeUsers) {
                    const userSocketId = req.activeUsers.get(userId.toString());
                    if (userSocketId) {
                        req.io.to(userSocketId).emit('assignmentUnreadUpdated', { 
                            assignmentId: assignmentId, 
                            unreadCount: 0 
                        });
                        console.log(`📨 Chat: Broadcasted assignmentUnreadUpdated directly to socket ${userSocketId} (getMessages)`);
                    }
                }
            }
            
            // Also emit refresh event to update assignments list
            emitSocketEvent(req, userId.toString(), 'refreshAssignments', null);
            console.log(`📨 Chat: Emitted refreshAssignments event for user ${userId.toString()}`);
            
            // Also refresh for other participants if this is an assignment chat
            if (conversation.assignment && conversation.participants) {
                conversation.participants.forEach(participant => {
                    const participantId = participant._id ? participant._id.toString() : participant.toString();
                    if (participantId !== userId.toString()) {
                        if (conversation.assignment) {
                            const assignmentId = conversation.assignment._id ? conversation.assignment._id.toString() : conversation.assignment.toString();
                            emitSocketEvent(req, participantId, 'assignmentUnreadUpdated', { 
                                assignmentId: assignmentId, 
                                unreadCount: 0 
                            });
                        }
                        emitSocketEvent(req, participantId, 'refreshAssignments', null);
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error marking conversation as viewed:', error);
    }
    
    console.log(`📨 Chat: Returning ${formatted.length} formatted messages`);
    res.json(formatted);
});

// @desc    Send a message
// @route   POST /api/chats/:conversationId/messages
// @access  Private
const sendMessage = asyncHandler(async (req, res) => {
    const { text } = req.body;
    const conversationId = req.params.conversationId;
    const senderId = req.user._id;

    // Validate for contact information (only for client-writer chats, not admin chats)
    const conversation = await Conversation.findById(conversationId)
        .populate('participants', 'role');
    
    if (!conversation) {
        res.status(404);
        throw new Error('Conversation not found');
    }

    // Check if this is a conversation between client and writer (not admin)
    const participants = conversation.participants;
    const hasClient = participants.some(p => p.role === 'user');
    const hasWriter = participants.some(p => p.role === 'writer');
    const hasAdmin = participants.some(p => p.role === 'admin');

    // Validate contact info for client-writer conversations (block sharing contact info)
    if ((hasClient && hasWriter) && !hasAdmin) {
        const validation = validateNoContactInfo(text);
        if (!validation.isValid) {
            res.status(400);
            throw new Error(validation.errorMessage || 'This message contains restricted information.');
        }
    }
    
    // Also validate if sender is a user and recipient is a writer (direct client-writer communication)
    // BUT ONLY if it's NOT an admin chat (admin chats allow contact info)
    if (req.user.role === 'user' && !hasAdmin) {
        const otherParticipant = participants.find(p => p._id.toString() !== senderId.toString());
        if (otherParticipant && otherParticipant.role === 'writer') {
            const validation = validateNoContactInfo(text);
            if (!validation.isValid) {
                res.status(400);
                throw new Error(validation.errorMessage || 'This message contains restricted information.');
            }
        }
    }
    
    // Also validate if sender is a writer and recipient is a user (direct writer-client communication)
    // BUT ONLY if it's NOT an admin chat (admin chats allow contact info)
    if (req.user.role === 'writer' && !hasAdmin) {
        const otherParticipant = participants.find(p => p._id.toString() !== senderId.toString());
        if (otherParticipant && otherParticipant.role === 'user') {
            const validation = validateNoContactInfo(text);
            if (!validation.isValid) {
                res.status(400);
                throw new Error(validation.errorMessage || 'This message contains restricted information.');
            }
        }
    }

    const newMessage = await Message.create({
        sender: senderId,
        text: text,
        conversation: conversationId,
    });

    conversation.lastMessage = newMessage._id;
    await conversation.save();
    
    const populatedMessage = await Message.findById(newMessage._id).populate('sender', 'name role');

    const updatedConversation = await Conversation.findById(conversationId)
        .populate('participants', 'name avatar role')
        .populate('assignment', 'title')
        .populate({
            path: 'lastMessage',
            populate: { path: 'sender', select: 'name role' }
        });

    // Determine recipient (the other participant) using safe _id access
    const recipientDoc = conversation.participants.find(p => {
        const pid = p?._id ? p._id.toString() : p?.toString?.();
        return pid && pid !== senderId.toString();
    });
    const recipientId = recipientDoc?._id ? recipientDoc._id : recipientDoc; // ObjectId or string
    const adminUsers = await User.find({ role: 'admin' });

    const messagePayload = {
        id: populatedMessage._id,
        chatId: conversationId.toString(),
        text: populatedMessage.text,
        timestamp: populatedMessage.createdAt,
        senderName: populatedMessage.sender.name,
        senderId: populatedMessage.sender._id,
        senderRole: populatedMessage.sender.role || 'user',
    };

    // Emit to recipient (but NOT to sender - they already have it from API response)
    if (recipientId) {
        const recipientIdStr = recipientId.toString();
        const senderIdStr = senderId.toString();
        // Only emit to recipient if they're not the sender
        if (recipientIdStr !== senderIdStr) {
            console.log(`📨 Chat: Emitting message to recipient ${recipientIdStr}`);
            emitSocketEvent(req, recipientIdStr, 'receiveMessage', { ...messagePayload, isOwnMessage: false });
        }
        emitSocketEvent(req, recipientIdStr, 'updateConversation', await formatConversationForUser(updatedConversation, recipientIdStr, false));
        
        // Create notification for recipient
        try {
            const notification = await Notification.create({
                user: recipientIdDocId(recipientId),
                message: `You have a new message from ${req.user.name}.`,
                type: 'message',
                link: '/chat'
            });
            emitSocketEvent(req, recipientIdStr, 'newNotification', notification.toJSON());
        } catch (notifError) {
            console.error('Chat: Error creating notification:', notifError);
        }
    }

    // Update sender's conversation list (but don't send receiveMessage to sender - they already have it from API response)
    const senderIdStr = senderId.toString();
    console.log(`📨 Chat: Updating conversation for sender ${senderIdStr}`);
    emitSocketEvent(req, senderIdStr, 'updateConversation', await formatConversationForUser(updatedConversation, senderIdStr, req.user.role === 'admin'));
    
    // Emit to all admins for monitoring (but exclude the sender if they're an admin)
    for (const admin of adminUsers) {
        const adminIdStr = admin._id.toString();
        // Don't send receiveMessage to the sender - they already added it from API response
        if (adminIdStr !== senderIdStr) {
            console.log(`📨 Chat: Emitting to admin ${adminIdStr}`);
            emitSocketEvent(req, adminIdStr, 'receiveMessage', { ...messagePayload, isOwnMessage: false });
        }
        // Still update conversation list for all admins including sender
        const formattedConvo = await formatConversationForUser(updatedConversation, adminIdStr, true);
        emitSocketEvent(req, adminIdStr, 'updateConversation', formattedConvo);
    }


    res.status(201).json({ ...messagePayload, isOwnMessage: true });
});

// @desc    Mark messages as read for a conversation
// @route   PUT /api/chats/:conversationId/read
// @access  Private
const markMessagesAsRead = asyncHandler(async (req, res) => {
    const conversationId = req.params.conversationId;
    const userId = req.user._id;
    
    try {
        const conversation = await Conversation.findById(conversationId).populate('assignment');
        if (!conversation) {
            res.status(404);
            throw new Error('Conversation not found');
        }
        
        // Update lastViewedBy timestamp for this user
        if (!conversation.lastViewedBy) {
            conversation.lastViewedBy = {};
        }
        conversation.lastViewedBy[userId.toString()] = new Date().toISOString();
        conversation.markModified('lastViewedBy'); // Important: mark as modified for Mixed type
        await conversation.save();
        
        // Emit specific event with assignment ID for immediate update
        if (conversation.assignment) {
            const assignmentId = conversation.assignment._id ? conversation.assignment._id.toString() : conversation.assignment.toString();
            emitSocketEvent(req, userId.toString(), 'assignmentUnreadUpdated', { 
                assignmentId: assignmentId, 
                unreadCount: 0 
            });
            console.log(`📨 Chat: Emitted assignmentUnreadUpdated socket event for assignment ${assignmentId} (markMessagesAsRead)`);
            
            // Also broadcast to all connected clients of this user (for cross-tab updates)
            if (req.io && req.activeUsers) {
                const userSocketId = req.activeUsers.get(userId.toString());
                if (userSocketId) {
                    req.io.to(userSocketId).emit('assignmentUnreadUpdated', { 
                        assignmentId: assignmentId, 
                        unreadCount: 0 
                    });
                    console.log(`📨 Chat: Also broadcasted assignmentUnreadUpdated to socket ${userSocketId}`);
                }
            }
        }
        
        // Also emit refresh event to update assignments list
        emitSocketEvent(req, userId.toString(), 'refreshAssignments', null);
        console.log(`📨 Chat: Emitted refreshAssignments event for user ${userId.toString()} (markMessagesAsRead)`);
        
        // Also refresh for other participants if this is an assignment chat
        if (conversation.assignment && conversation.participants) {
            conversation.participants.forEach(participant => {
                const participantId = participant._id ? participant._id.toString() : participant.toString();
                if (participantId !== userId.toString()) {
                    if (conversation.assignment) {
                        const assignmentId = conversation.assignment._id ? conversation.assignment._id.toString() : conversation.assignment.toString();
                        emitSocketEvent(req, participantId, 'assignmentUnreadUpdated', { 
                            assignmentId: assignmentId, 
                            unreadCount: 0 
                        });
                    }
                    emitSocketEvent(req, participantId, 'refreshAssignments', null);
                    console.log(`📨 Chat: Emitted refreshAssignments event for participant ${participantId}`);
                }
            });
        }
        
        res.json({ success: true, unreadCount: 0 });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500);
        throw new Error('Failed to mark messages as read');
    }
});

export { getConversations, getMessages, sendMessage, markMessagesAsRead };