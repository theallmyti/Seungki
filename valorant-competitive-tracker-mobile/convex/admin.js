import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Verify if the user is an admin */
async function checkAdmin(ctx, userId) {
    const user = await ctx.db.get(userId);
    if (!user || !user.isAdmin) {
        throw new Error("Unauthorized: Admin privileges required.");
    }
    return user;
}

export const searchAllUsers = query({
    args: { adminId: v.id("users"), searchQuery: v.string() },
    handler: async (ctx, args) => {
        await checkAdmin(ctx, args.adminId);
        
        const q = args.searchQuery.trim().toLowerCase();
        const allUsers = await ctx.db.query("users").collect();
        
        if (!q) {
            return allUsers.slice(0, 50).map(u => ({
                _id: u._id,
                username: u.username,
                coins: u.coins,
                isAdmin: !!u.isAdmin
            }));
        }

        const matches = allUsers.filter(u => {
            return u.username.toLowerCase().includes(q) || (u.shortId && u.shortId.includes(q));
        });

        return matches.slice(0, 50).map(u => ({
            _id: u._id,
            username: u.username,
            coins: u.coins,
            isAdmin: !!u.isAdmin
        }));
    }
});

export const removeUser = mutation({
    args: { adminId: v.id("users"), targetUserId: v.id("users") },
    handler: async (ctx, args) => {
        await checkAdmin(ctx, args.adminId);
        
        // Ensure not deleting self
        if (args.adminId === args.targetUserId) {
            throw new Error("You cannot delete your own admin account.");
        }
        
        // We could also delete bets, transactions, friend requests, notifications related to this user
        // For simplicity, just delete the user document
        await ctx.db.delete(args.targetUserId);
        return { success: true };
    }
});

export const giveCoins = mutation({
    args: { adminId: v.id("users"), targetUserId: v.id("users"), amount: v.number() },
    handler: async (ctx, args) => {
        await checkAdmin(ctx, args.adminId);
        
        const targetUser = await ctx.db.get(args.targetUserId);
        if (!targetUser) throw new Error("User not found");
        
        await ctx.db.patch(args.targetUserId, { coins: targetUser.coins + args.amount });
        
        // Log transaction
        await ctx.db.insert("transactions", {
            userId: args.targetUserId,
            amount: args.amount,
            type: "admin_grant",
            timestamp: Date.now(),
        });
        
        return { success: true };
    }
});

export const setAdminpeoAdmin = mutation({
    args: {},
    handler: async (ctx, args) => {
        const adminpeo = await ctx.db
            .query("users")
            .withIndex("by_username", (q) => q.eq("username", "adminpeo"))
            .unique();
            
        if (adminpeo) {
            await ctx.db.patch(adminpeo._id, { isAdmin: true });
            return "Success: adminpeo is now an admin.";
        }
        return "User adminpeo not found.";
    }
});

export const toggleSuspendUser = mutation({
    args: { adminId: v.id("users"), targetUserId: v.id("users"), suspend: v.boolean() },
    handler: async (ctx, args) => {
        await checkAdmin(ctx, args.adminId);
        if (args.adminId === args.targetUserId) throw new Error("Cannot suspend yourself.");
        await ctx.db.patch(args.targetUserId, { isSuspended: args.suspend });
        return { success: true };
    }
});

export const broadcastNotification = mutation({
    args: { adminId: v.id("users"), title: v.string(), message: v.string() },
    handler: async (ctx, args) => {
        await checkAdmin(ctx, args.adminId);
        const allUsers = await ctx.db.query("users").collect();
        const now = Date.now();
        for (const user of allUsers) {
            await ctx.db.insert("notifications", {
                userId: user._id,
                type: "friend_accept",
                title: args.title,
                message: args.message,
                senderId: args.adminId,
                read: false,
                createdAt: now,
            });
            // Could call an action to send push notifications here
        }
        return { success: true, count: allUsers.length };
    }
});

export const refundMatchBets = mutation({
    args: { adminId: v.id("users"), matchId: v.string() },
    handler: async (ctx, args) => {
        await checkAdmin(ctx, args.adminId);
        const bets = await ctx.db.query("bets").withIndex("by_matchId", q => q.eq("matchId", args.matchId)).collect();
        let refunded = 0;
        for (const bet of bets) {
            if (bet.status === "pending") {
                const user = await ctx.db.get(bet.userId);
                if (user) {
                    await ctx.db.patch(user._id, { coins: user.coins + bet.amount });
                    await ctx.db.insert("transactions", {
                        userId: user._id,
                        amount: bet.amount,
                        type: "bet_refunded",
                        matchId: args.matchId,
                        timestamp: Date.now()
                    });
                }
                await ctx.db.patch(bet._id, { status: "refunded" });
                refunded++;
            }
        }
        return { success: true, count: refunded };
    }
});

export const updateMatchStatus = mutation({
    args: { adminId: v.id("users"), matchId: v.string(), status: v.string(), team1Score: v.optional(v.number()), team2Score: v.optional(v.number()) },
    handler: async (ctx, args) => {
        await checkAdmin(ctx, args.adminId);
        const match = await ctx.db.query("matches").withIndex("by_vlr_id", q => q.eq("vlrId", args.matchId)).unique();
        if (!match) throw new Error("Match not found");
        const patchData = { status: args.status };
        if (args.team1Score !== undefined) {
            patchData.team1 = { ...match.team1, score: args.team1Score };
        }
        if (args.team2Score !== undefined) {
            patchData.team2 = { ...match.team2, score: args.team2Score };
        }
        await ctx.db.patch(match._id, patchData);
        return { success: true };
    }
});
