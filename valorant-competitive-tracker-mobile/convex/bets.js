import { mutation, query, internalMutation } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

// ── Migration helpers ──────────────────────────────────────────────────────

/** Dump every bet row (used by migration script). */
export const getAllBets = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("bets").collect();
    },
});

/** Insert a bet directly with its existing status (migration only, no coin deduction). */
export const importBet = mutation({
    args: {
        apiKey: v.string(),
        userId: v.id("users"),
        matchId: v.string(),
        amount: v.number(),
        teamId: v.string(),
        status: v.union(v.literal("pending"), v.literal("won"), v.literal("lost")),
    },
    handler: async (ctx, args) => {
        const { apiKey, ...betData } = args;
        if (apiKey !== process.env.CONVEX_API_KEY) throw new Error("Unauthorized");
        // Skip if duplicate
        const existing = await ctx.db
            .query("bets")
            .withIndex("by_userId", (q) => q.eq("userId", betData.userId))
            .filter((q) => q.eq(q.field("matchId"), betData.matchId))
            .first();
        if (existing) return { skipped: true };
        await ctx.db.insert("bets", betData);
        return { skipped: false };
    },
});


export const getBetCountForMatch = query({
    args: { matchId: v.string() },
    handler: async (ctx, args) => {
        const bets = await ctx.db
            .query("bets")
            .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId))
            .collect();
        return bets.length;
    }
});

export const getBetsForMatch = query({
    args: { matchId: v.string() },
    handler: async (ctx, args) => {
        const bets = await ctx.db
            .query("bets")
            .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId))
            .collect();

        // Join with users to get usernames
        const betsWithUsers = await Promise.all(
            bets.map(async (bet) => {
                const user = await ctx.db.get(bet.userId);
                return {
                    ...bet,
                    username: user ? user.username : "Unknown User",
                    pfp: user ? user.pfp : null
                };
            })
        );
        return betsWithUsers;
    }
});
export const placeBet = mutation({
    args: {
        userId: v.id("users"),
        matchId: v.string(),
        amount: v.number(),
        teamId: v.string(), // team being bet on
    },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) throw new Error("User not found");

        const match = await ctx.db
            .query("matches")
            .withIndex("by_vlr_id", (q) => q.eq("vlrId", args.matchId))
            .unique();
        if (match && match.status !== "upcoming") {
            throw new Error("Betting is locked. Bets can only be placed on upcoming matches.");
        }

        if (user.coins < args.amount) {
            throw new Error("Insufficient coins");
        }

        // Prevent multiple bets on the same match by the same user
        const existingBet = await ctx.db
            .query("bets")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .filter((q) => q.eq(q.field("matchId"), args.matchId))
            .first();

        if (existingBet) {
            throw new Error("You have already placed a bet on this match");
        }

        // Deduct coins
        await ctx.db.patch(args.userId, {
            coins: user.coins - args.amount
        });

        await ctx.db.insert("bets", {
            userId: args.userId,
            matchId: args.matchId,
            amount: args.amount,
            teamId: args.teamId,
            status: "pending"
        });

        await ctx.db.insert("transactions", {
            userId: args.userId,
            amount: -args.amount,
            type: "bet_placed",
            matchId: args.matchId,
            timestamp: Date.now()
        });

        return { success: true };
    }
});

export const updateBet = mutation({
    args: {
        userId: v.id("users"),
        matchId: v.string(),
        newAmount: v.number(),
        newTeamId: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) throw new Error("User not found");

        const match = await ctx.db
            .query("matches")
            .withIndex("by_vlr_id", (q) => q.eq("vlrId", args.matchId))
            .unique();
        if (match && match.status !== "upcoming") {
            throw new Error("Bets are locked and cannot be edited once the match is live or completed.");
        }

        const existingBet = await ctx.db
            .query("bets")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .filter((q) => q.eq(q.field("matchId"), args.matchId))
            .first();

        if (!existingBet) throw new Error("No existing bet found to edit");
        if (existingBet.status !== "pending") throw new Error("Cannot edit a bet that has already been settled");

        const amountDiff = args.newAmount - existingBet.amount;
        const newCoins = user.coins - amountDiff;
        if (newCoins < 0) throw new Error("Insufficient coins");
        if (args.newAmount < 10) throw new Error("Minimum bet amount is 10 coins");

        await ctx.db.patch(args.userId, { coins: newCoins });
        await ctx.db.patch(existingBet._id, {
            amount: args.newAmount,
            teamId: args.newTeamId,
        });

        if (amountDiff !== 0) {
            await ctx.db.insert("transactions", {
                userId: args.userId,
                amount: -amountDiff,
                type: "bet_edited",
                matchId: args.matchId,
                timestamp: Date.now(),
            });
        }

        return { success: true };
    }
});

export const cancelBet = mutation({
    args: {
        userId: v.id("users"),
        matchId: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) throw new Error("User not found");

        const match = await ctx.db
            .query("matches")
            .withIndex("by_vlr_id", (q) => q.eq("vlrId", args.matchId))
            .unique();
        if (match && match.status !== "upcoming") {
            throw new Error("Bets are locked and cannot be cancelled once the match is live or completed.");
        }

        const existingBet = await ctx.db
            .query("bets")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .filter((q) => q.eq(q.field("matchId"), args.matchId))
            .first();

        if (!existingBet) throw new Error("No bet found to cancel");
        if (existingBet.status !== "pending") throw new Error("Cannot cancel a bet that has already been settled");

        const refundAmount = existingBet.amount;

        // Refund coins to user balance
        await ctx.db.patch(args.userId, {
            coins: user.coins + refundAmount,
        });

        // Remove bet record
        await ctx.db.delete(existingBet._id);

        // Record refund transaction
        await ctx.db.insert("transactions", {
            userId: args.userId,
            amount: refundAmount,
            type: "bet_refunded",
            matchId: args.matchId,
            timestamp: Date.now(),
        });

        return { success: true, refundAmount };
    }
});




export const resolveMatchBets = async (ctx, args) => {
    const bets = await ctx.db
        .query("bets")
        .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId))
        .filter((q) => q.eq(q.field("status"), "pending"))
        .collect();

        
    if (bets.length === 0) return; // No pending bets
    
    let totalWinnerPool = 0;
    let totalLoserPool = 0;
    const winningBets = [];
    const losingBets = [];
    
    for (const bet of bets) {
        if (bet.teamId === args.winningTeamId) {
            totalWinnerPool += bet.amount;
            winningBets.push(bet);
        } else {
            totalLoserPool += bet.amount;
            losingBets.push(bet);
        }
    }
    
    // Process losers
    for (const bet of losingBets) {
        await ctx.db.patch(bet._id, { status: "lost" });
        
        await ctx.db.insert("transactions", {
            userId: bet.userId,
            amount: 0, // 0 because it was already deducted when placed. This just records the loss event if needed.
            type: "bet_lost",
            matchId: args.matchId,
            timestamp: Date.now()
        });
        
        const user = await ctx.db.get(bet.userId);
        if (user && user.pushToken) {
            await ctx.scheduler.runAfter(0, api.expoPush.sendExpoPushNotification, {
                pushToken: user.pushToken,
                title: "Bet Lost",
                body: `You lost your bet of ${bet.amount} coins on match ${args.matchId}.`,
            });
        }
    }
    
    // Process winners
    for (const bet of winningBets) {
        let payout = bet.amount; // Original bet back
        let profit = 0;
        
        if (totalLoserPool === 0) {
            // If everyone bet on the same winning team
            profit = 0;
        } else {
            // Pari-mutuel proportional division
            const proportion = bet.amount / totalWinnerPool;
            profit = Math.floor(proportion * totalLoserPool);
        }
        
        payout += profit;
        
        // Mark bet won
        await ctx.db.patch(bet._id, { status: "won" });
        
        // Add coins to user
        const user = await ctx.db.get(bet.userId);
        if (user) {
            await ctx.db.patch(user._id, { coins: user.coins + payout });
            if (user.pushToken) {
                await ctx.scheduler.runAfter(0, api.expoPush.sendExpoPushNotification, {
                    pushToken: user.pushToken,
                    title: "Bet Won!",
                    body: `You won ${payout} coins (Profit: ${profit}) on match ${args.matchId}!`,
                });
            }
        }
        
        // Record transaction for the total payout
        await ctx.db.insert("transactions", {
            userId: bet.userId,
            amount: payout, // This is the total added to their account (original + profit)
            type: "bet_won",
            matchId: args.matchId,
            timestamp: Date.now()
        });
    }
};

export const getUserTransactions = query({
    args: { userId: v.optional(v.id("users")) },
    handler: async (ctx, args) => {
        if (!args.userId) return [];
        const transactions = await ctx.db
            .query("transactions")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .order("desc")
            .collect();
            
        // We might want to enrich transactions with match details here if needed,
        // but for now just returning the raw transactions is enough.
        return transactions;
    }
});
