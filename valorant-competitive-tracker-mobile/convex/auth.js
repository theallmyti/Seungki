import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Helper to hash password with salt
async function hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate random salt
function generateSalt() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const signup = mutation({
    args: { 
        username: v.string(), 
        password: v.string(),
        email: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        const username = args.username.trim().toLowerCase();
        
        // Validate username formatting
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            throw new Error("Invalid username format");
        }

        const existing = await ctx.db
            .query("users")
            .withIndex("by_username", (q) => q.eq("username", username))
            .unique();
            
        if (existing) {
            throw new Error("Username already taken");
        }

        const salt = generateSalt();
        const passwordHash = await hashPassword(args.password, salt);

        const shortId = Math.floor(1000000000 + Math.random() * 9000000000).toString();

        const userId = await ctx.db.insert("users", {
            username,
            email: args.email,
            passwordHash,
            salt,
            friends: [],
            coins: 1000,
            shortId,
        });

        return userId;
    }
});

export const login = mutation({
    args: { 
        username: v.string(), 
        password: v.string() 
    },
    handler: async (ctx, args) => {
        const username = args.username.trim().toLowerCase();
        
        const user = await ctx.db
            .query("users")
            .withIndex("by_username", (q) => q.eq("username", username))
            .unique();
            
        if (!user) {
            throw new Error("Username not found");
        }

        const passwordHash = await hashPassword(args.password, user.salt);
        
        if (passwordHash !== user.passwordHash) {
            throw new Error("Invalid password");
        }

        return user._id;
    }
});

export const updateProfile = mutation({
    args: {
        userId: v.id("users"),
        name: v.optional(v.string()),
        age: v.optional(v.number()),
        gender: v.optional(v.string()),
        pfp: v.optional(v.string()),
        favoriteTeams: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const { userId, ...updates } = args;
        
        const user = await ctx.db.get(userId);
        if (!user) throw new Error("User not found");

        await ctx.db.patch(userId, updates);
        return { success: true };
    }
});
