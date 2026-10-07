import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { matchSchema } from "./shared.js";

export default defineSchema({
    matches: defineTable(matchSchema)
        .index("by_vlr_id", ["vlrId"])
        .index("by_status", ["status"])
        .index("by_status_time", ["status", "time"])
        .searchIndex("by_search_terms_and_status", {
            searchField: "searchTerms",
            filterFields: ["status"],
        }),
    users: defineTable({
        username: v.string(), // unique, lowercase
        email: v.optional(v.string()), // optional for now
        passwordHash: v.string(),
        salt: v.string(),
        name: v.optional(v.string()),
        age: v.optional(v.number()),
        gender: v.optional(v.string()),
        pfp: v.optional(v.string()),
        favoriteTeams: v.optional(v.array(v.string())),
        friends: v.optional(v.array(v.id("users"))),
        coins: v.number(), // Starting balance of 1000
        lastFavoriteUpdate: v.optional(v.number()),
        shortId: v.optional(v.string()), // 10-digit UID
    }).index("by_username", ["username"])
      .index("by_shortId", ["shortId"]),

    bets: defineTable({
        userId: v.id("users"),
        matchId: v.string(), // We will use vlrId as the matchId string
        amount: v.number(),
        teamId: v.string(), // the team they are betting on
        status: v.optional(v.union(v.literal("pending"), v.literal("won"), v.literal("lost"), v.literal("refunded"))),
    }).index("by_matchId", ["matchId"])
      .index("by_userId", ["userId"]),
      
    transactions: defineTable({
        userId: v.id("users"),
        amount: v.number(),
        type: v.union(v.literal("bet_placed"), v.literal("bet_won"), v.literal("bet_lost"), v.literal("fav_team_win"), v.literal("bet_edited"), v.literal("bet_refunded")),
        matchId: v.optional(v.string()), // Optional, only if related to a match
        timestamp: v.number(),
    }).index("by_userId", ["userId"]),

    friend_requests: defineTable({
        senderId: v.id("users"),
        receiverId: v.id("users"),
        status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("declined")),
        createdAt: v.number(),
    })
        .index("by_receiver_status", ["receiverId", "status"])
        .index("by_sender_receiver", ["senderId", "receiverId"])
        .index("by_receiver", ["receiverId"])
        .index("by_sender", ["senderId"]),

    notifications: defineTable({
        userId: v.id("users"),
        type: v.union(v.literal("friend_request"), v.literal("friend_accept"), v.literal("system")),
        title: v.string(),
        message: v.string(),
        senderId: v.optional(v.id("users")),
        requestId: v.optional(v.id("friend_requests")),
        read: v.boolean(),
        createdAt: v.number(),
    })
        .index("by_userId", ["userId"])
        .index("by_userId_read", ["userId", "read"]),
});