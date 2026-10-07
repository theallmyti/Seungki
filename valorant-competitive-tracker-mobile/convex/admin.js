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
