import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ── Migration helpers ──────────────────────────────────────────────────────

/** Dump every user row (used by the migration script). */
export const getAllUsers = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("users").collect();
    },
});

/** Look up a single user by username (used by migration for conflict resolution). */
export const getUserByUsername = query({
    args: { username: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("users")
            .withIndex("by_username", (q) => q.eq("username", args.username.toLowerCase()))
            .unique();
    },
});

/** Insert a user with full credentials — bypasses normal signup (migration only). */
export const importUser = mutation({
    args: {
        apiKey: v.string(),
        username: v.string(),
        email: v.union(v.string(), v.null()),
        passwordHash: v.string(),
        salt: v.string(),
        coins: v.number(),
        shortId: v.string(),
        name: v.union(v.string(), v.null()),
        age: v.union(v.number(), v.null()),
        gender: v.union(v.string(), v.null()),
        pfp: v.union(v.string(), v.null()),
        favoriteTeams: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        const { apiKey, ...userData } = args;
        if (apiKey !== process.env.CONVEX_API_KEY) throw new Error("Unauthorized");
        const existing = await ctx.db
            .query("users")
            .withIndex("by_username", (q) => q.eq("username", userData.username))
            .unique();
        if (existing) throw new Error("Username already taken");
        return await ctx.db.insert("users", {
            ...userData,
            friends: [],
        });
    },
});

export const sendFriendRequest = mutation({
    args: {
        senderId: v.id("users"),
        targetIdentifier: v.string()
    },
    handler: async (ctx, args) => {
        const sender = await ctx.db.get(args.senderId);
        if (!sender) throw new Error("User not found");

        const targetQuery = args.targetIdentifier.trim();

        // 1. Try by username
        let target = await ctx.db
            .query("users")
            .withIndex("by_username", (q) => q.eq("username", targetQuery.toLowerCase()))
            .unique();

        // 2. Try by shortId
        if (!target) {
            target = await ctx.db
                .query("users")
                .withIndex("by_shortId", (q) => q.eq("shortId", targetQuery))
                .unique();
        }

        // 3. Try by Convex ID
        if (!target) {
            try {
                target = await ctx.db.get(targetQuery);
            } catch (e) {}
        }

        if (!target) {
            throw new Error("User not found. Check Username or 10-digit UID.");
        }

        if (target._id === args.senderId) {
            throw new Error("Cannot add yourself as a friend.");
        }

        const senderFriends = sender.friends || [];
        if (senderFriends.includes(target._id)) {
            throw new Error("You are already friends!");
        }

        // Check if there's already a pending request sent by sender
        const existingSent = await ctx.db
            .query("friend_requests")
            .withIndex("by_sender_receiver", (q) => q.eq("senderId", args.senderId).eq("receiverId", target._id))
            .first();

        if (existingSent && existingSent.status === "pending") {
            throw new Error("Friend request already sent!");
        }

        // Check if target already sent a request to sender (auto-accept)
        const existingReceived = await ctx.db
            .query("friend_requests")
            .withIndex("by_sender_receiver", (q) => q.eq("senderId", target._id).eq("receiverId", args.senderId))
            .first();

        if (existingReceived && existingReceived.status === "pending") {
            await ctx.db.patch(existingReceived._id, { status: "accepted" });

            const targetFriends = target.friends || [];
            if (!senderFriends.includes(target._id)) {
                await ctx.db.patch(args.senderId, { friends: [...senderFriends, target._id] });
            }
            if (!targetFriends.includes(args.senderId)) {
                await ctx.db.patch(target._id, { friends: [...targetFriends, args.senderId] });
            }

            await ctx.db.insert("notifications", {
                userId: target._id,
                type: "friend_accept",
                title: "Friend Request Accepted",
                message: `@${sender.username} accepted your friend request!`,
                senderId: args.senderId,
                read: false,
                createdAt: Date.now(),
            });

            return { success: true, friendUsername: target.username, autoAccepted: true };
        }

        // Create new pending friend request
        const reqId = await ctx.db.insert("friend_requests", {
            senderId: args.senderId,
            receiverId: target._id,
            status: "pending",
            createdAt: Date.now(),
        });

        // Create notification for target user
        await ctx.db.insert("notifications", {
            userId: target._id,
            type: "friend_request",
            title: "New Friend Request",
            message: `@${sender.username} sent you a friend request.`,
            senderId: args.senderId,
            requestId: reqId,
            read: false,
            createdAt: Date.now(),
        });

        return { success: true, friendUsername: target.username, autoAccepted: false };
    }
});

// Legacy addFriend alias for backward compatibility
export const addFriend = mutation({
    args: { 
        userId: v.id("users"), 
        friendIdentifier: v.string() 
    },
    handler: async (ctx, args) => {
        return await sendFriendRequest(ctx, {
            senderId: args.userId,
            targetIdentifier: args.friendIdentifier
        });
    }
});

export const searchUsers = query({
    args: {
        currentUserId: v.id("users"),
        query: v.string()
    },
    handler: async (ctx, args) => {
        const q = args.query.trim().toLowerCase();
        if (!q || q.length < 1) return [];

        const allUsers = await ctx.db.query("users").collect();
        const currentUser = await ctx.db.get(args.currentUserId);
        if (!currentUser) return [];

        const userFriends = currentUser.friends || [];

        // Fetch user's pending sent requests
        const pendingSent = await ctx.db
            .query("friend_requests")
            .withIndex("by_sender", (qIdx) => qIdx.eq("senderId", args.currentUserId))
            .filter((qIdx) => qIdx.eq(qIdx.field("status"), "pending"))
            .collect();
        const pendingSentMap = new Map(pendingSent.map(r => [r.receiverId, r._id]));

        // Fetch user's pending received requests
        const pendingReceived = await ctx.db
            .query("friend_requests")
            .withIndex("by_receiver_status", (qIdx) => qIdx.eq("receiverId", args.currentUserId).eq("status", "pending"))
            .collect();
        const pendingReceivedMap = new Map(pendingReceived.map(r => [r.senderId, r._id]));

        const matches = allUsers.filter(u => {
            if (u._id === args.currentUserId) return false;
            const matchUsername = u.username.toLowerCase().includes(q);
            const matchName = u.name ? u.name.toLowerCase().includes(q) : false;
            const matchShortId = u.shortId ? u.shortId.includes(q) : false;
            return matchUsername || matchName || matchShortId;
        });

        return matches.slice(0, 8).map(u => {
            let relationship = "none";
            let requestId = undefined;

            if (userFriends.includes(u._id)) {
                relationship = "friends";
            } else if (pendingSentMap.has(u._id)) {
                relationship = "pending_sent";
                requestId = pendingSentMap.get(u._id);
            } else if (pendingReceivedMap.has(u._id)) {
                relationship = "pending_received";
                requestId = pendingReceivedMap.get(u._id);
            }

            return {
                _id: u._id,
                username: u.username,
                name: u.name,
                pfp: u.pfp,
                shortId: u.shortId || u._id.slice(0, 10),
                relationship,
                requestId
            };
        });
    }
});

export const getPendingRequests = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const requests = await ctx.db
            .query("friend_requests")
            .withIndex("by_receiver_status", (q) => q.eq("receiverId", args.userId).eq("status", "pending"))
            .collect();

        const populated = await Promise.all(
            requests.map(async (req) => {
                const sender = await ctx.db.get(req.senderId);
                if (!sender) return null;
                return {
                    _id: req._id,
                    createdAt: req.createdAt,
                    sender: {
                        _id: sender._id,
                        username: sender.username,
                        name: sender.name,
                        pfp: sender.pfp,
                        shortId: sender.shortId || sender._id.slice(0, 10),
                    }
                };
            })
        );

        return populated.filter(Boolean);
    }
});

export const respondToFriendRequest = mutation({
    args: {
        requestId: v.id("friend_requests"),
        userId: v.id("users"),
        action: v.union(v.literal("accept"), v.literal("decline"))
    },
    handler: async (ctx, args) => {
        const request = await ctx.db.get(args.requestId);
        if (!request || request.receiverId !== args.userId || request.status !== "pending") {
            throw new Error("Friend request invalid or already processed.");
        }

        if (args.action === "decline") {
            await ctx.db.patch(args.requestId, { status: "declined" });
            return { success: true, action: "declined" };
        }

        await ctx.db.patch(args.requestId, { status: "accepted" });

        const receiver = await ctx.db.get(args.userId);
        const sender = await ctx.db.get(request.senderId);

        if (receiver && sender) {
            const receiverFriends = receiver.friends || [];
            const senderFriends = sender.friends || [];

            if (!receiverFriends.includes(sender._id)) {
                await ctx.db.patch(receiver._id, { friends: [...receiverFriends, sender._id] });
            }
            if (!senderFriends.includes(receiver._id)) {
                await ctx.db.patch(sender._id, { friends: [...senderFriends, receiver._id] });
            }

            await ctx.db.insert("notifications", {
                userId: sender._id,
                type: "friend_accept",
                title: "Friend Request Accepted",
                message: `@${receiver.username} accepted your friend request!`,
                senderId: receiver._id,
                read: false,
                createdAt: Date.now(),
            });
        }

        return { success: true, action: "accepted" };
    }
});

export const getNotifications = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const notifs = await ctx.db
            .query("notifications")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .order("desc")
            .take(20);

        return notifs;
    },
});

export const markNotificationsRead = mutation({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const unread = await ctx.db
            .query("notifications")
            .withIndex("by_userId_read", (q) => q.eq("userId", args.userId).eq("read", false))
            .collect();

        for (const n of unread) {
            await ctx.db.patch(n._id, { read: true });
        }
        return { success: true };
    },
});

export const removeFriend = mutation({
    args: { userId: v.id("users"), friendId: v.id("users") },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        const friend = await ctx.db.get(args.friendId);

        if (user) {
            await ctx.db.patch(args.userId, {
                friends: (user.friends || []).filter(id => id !== args.friendId)
            });
        }
        if (friend) {
            await ctx.db.patch(args.friendId, {
                friends: (friend.friends || []).filter(id => id !== args.userId)
            });
        }
        return { success: true };
    }
});

export const getUserProfile = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) return null;

        // Auto-generate shortId for display if missing
        const shortId = user.shortId || Math.floor(1000000000 + Math.random() * 9000000000).toString();

        const friends = user.friends || [];
        const populatedFriends = await Promise.all(
            friends.map(async (friendId) => {
                const f = await ctx.db.get(friendId);
                if (!f) return null;
                return {
                    _id: f._id,
                    username: f.username,
                    name: f.name,
                    pfp: f.pfp,
                    shortId: f.shortId || f._id.slice(0, 10),
                };
            })
        );

        return {
            _id: user._id,
            username: user.username,
            name: user.name,
            age: user.age,
            gender: user.gender,
            pfp: user.pfp,
            favoriteTeams: user.favoriteTeams,
            friends: populatedFriends.filter(Boolean),
            coins: user.coins,
            lastFavoriteUpdate: user.lastFavoriteUpdate,
            shortId,
            isAdmin: user.isAdmin,
        };
    }
});

export const checkUsername = query({
    args: { username: v.string() },
    handler: async (ctx, args) => {
        if (!args.username || args.username.trim() === "") return { available: false };
        const existing = await ctx.db
            .query("users")
            .withIndex("by_username", (q) => q.eq("username", args.username.trim().toLowerCase()))
            .unique();
        return { available: !existing };
    }
});

export const updateProfilePicture = mutation({
    args: {
        userId: v.id("users"),
        base64Image: v.string()
    },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) throw new Error("User not found");

        await ctx.db.patch(args.userId, {
            pfp: args.base64Image
        });

        return { success: true };
    }
});

export const updateFavoriteTeams = mutation({
    args: {
        userId: v.id("users"),
        teams: v.array(v.string())
    },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) throw new Error("User not found");

        const now = Date.now();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

        if (user.lastFavoriteUpdate && (now - user.lastFavoriteUpdate < TWENTY_FOUR_HOURS)) {
            const hoursLeft = Math.ceil((TWENTY_FOUR_HOURS - (now - user.lastFavoriteUpdate)) / (1000 * 60 * 60));
            throw new Error(`You can change your favorite teams again in ${hoursLeft} hours.`);
        }

        if (args.teams.length > 2) {
            throw new Error("You can only select up to 2 favorite teams.");
        }

        await ctx.db.patch(args.userId, {
            favoriteTeams: args.teams,
            lastFavoriteUpdate: now
        });

        return { success: true };
    }
});
