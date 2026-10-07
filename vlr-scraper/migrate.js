/**
 * Migration script: copies users + bets from old Convex deployment to new one.
 *
 * The old deployment doesn't have the getAllUsers/getAllBets helpers, so we
 * call the Convex export REST API directly (no auth needed for dev deployments).
 *
 * Run: node migrate.js
 */

import { ConvexHttpClient } from "convex/browser";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const OLD_URL = "https://earnest-zebra-377.convex.cloud";
const NEW_URL = "https://loyal-leopard-468.convex.cloud";
const API_KEY = process.env.CONVEX_API_KEY;

const newClient = new ConvexHttpClient(NEW_URL);

/** Call a Convex query on any deployment via raw HTTP POST. */
async function rawQuery(deploymentUrl, functionPath, args = {}) {
    const res = await fetch(`${deploymentUrl}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: functionPath, args, format: "json" }),
    });
    const data = await res.json();
    if (data.status === "error") throw new Error(data.errorMessage);
    return data.value;
}

async function migrate() {
    console.log("🚀 Starting migration from old → new Convex deployment...\n");

    // ── 1. Fetch all users from OLD DB ─────────────────────────────────────
    console.log("📥 Fetching users from old deployment...");
    let oldUsers = [];
    try {
        oldUsers = await rawQuery(OLD_URL, "users:getAllUsers");
        console.log(`   Found ${oldUsers.length} user(s)`);
    } catch (e) {
        console.warn(`   ⚠️  getAllUsers not on old DB (${e.message}) — will use new DB users to map bets`);
    }

    // ── 2. Fetch all bets from OLD DB ───────────────────────────────────────
    console.log("📥 Fetching bets from old deployment...");
    let oldBets = [];
    try {
        oldBets = await rawQuery(OLD_URL, "bets:getAllBets");
        console.log(`   Found ${oldBets.length} bet(s)\n`);
    } catch (e) {
        console.warn(`   ⚠️  getAllBets not on old DB (${e.message})`);
    }

    // ── 3. Migrate users (if we got them) ──────────────────────────────────
    const oldIdToNewId = {};

    if (oldUsers.length > 0) {
        console.log("👤 Migrating users...");
        for (const user of oldUsers) {
            try {
                const newId = await newClient.mutation("users:importUser", {
                    apiKey: API_KEY,
                    username: user.username,
                    email: user.email ?? null,
                    passwordHash: user.passwordHash,
                    salt: user.salt,
                    coins: user.coins ?? 1000,
                    shortId: user.shortId,
                    name: user.name ?? null,
                    age: user.age ?? null,
                    gender: user.gender ?? null,
                    pfp: user.pfp ?? null,
                    favoriteTeams: user.favoriteTeams ?? [],
                });
                oldIdToNewId[user._id] = newId;
                console.log(`   ✅ Migrated user: ${user.username}  (old: ${user._id} → new: ${newId})`);
            } catch (e) {
                if (e.message?.includes("Username already taken")) {
                    const existing = await newClient.query("users:getUserByUsername", {
                        username: user.username,
                    });
                    if (existing) {
                        oldIdToNewId[user._id] = existing._id;
                        console.log(`   ⚠️  ${user.username} already exists → new ID: ${existing._id}`);
                    }
                } else {
                    console.error(`   ❌ Failed: ${user.username}:`, e.message);
                }
            }
        }
    }

    // ── 4. If no bets fetched from old DB, inject known bets from dashboard ─
    // Dashboard screenshots show 2 bets for user "Seungki":
    //   matchId: "753454"  teamId: "G2 Esports"  amount: 100  status: pending
    //   matchId: "753455"  teamId: "Paper Rex"   amount: 100  status: pending
    if (oldBets.length === 0) {
        console.log("\n📋 No bets fetched from old DB — injecting known bets from dashboard...");
        // Find target user in new DB
        const allNewUsers = await newClient.query("users:getAllUsers");
        if (allNewUsers.length > 0) {
            // Use the first user (Seungki), or match by username if you know it
            const targetUser = allNewUsers.find(u => u.username === "seungki") ?? allNewUsers[0];
            console.log(`   Targeting user: ${targetUser.username} (${targetUser._id})`);
            oldBets = [
                { userId: targetUser._id, matchId: "753454", teamId: "G2 Esports", amount: 100, status: "pending" },
                { userId: targetUser._id, matchId: "753455", teamId: "Paper Rex",  amount: 100, status: "pending" },
            ];
        } else {
            console.warn("   ⚠️  No users in new DB yet — create the account first by logging in, then re-run this script.");
            return;
        }
    }

    // ── 5. Migrate bets ────────────────────────────────────────────────────
    console.log("\n🎰 Migrating bets...");
    let betsMigrated = 0;
    for (const bet of oldBets) {
        const newUserId = oldIdToNewId[bet.userId] ?? bet.userId;
        try {
            const result = await newClient.mutation("bets:importBet", {
                apiKey: API_KEY,
                userId: newUserId,
                matchId: bet.matchId,
                amount: bet.amount,
                teamId: bet.teamId,
                status: bet.status,
            });
            if (result?.skipped) {
                console.log(`   ⚠️  Bet for match ${bet.matchId} already exists, skipped`);
            } else {
                betsMigrated++;
                console.log(`   ✅ Bet migrated: match ${bet.matchId} | ${bet.teamId} | ${bet.amount}c | ${bet.status}`);
            }
        } catch (e) {
            console.error(`   ❌ Failed bet for match ${bet.matchId}:`, e.message);
        }
    }

    // ── 6. Summary ─────────────────────────────────────────────────────────
    console.log("\n✅ Migration complete!");
    console.log(`   Users migrated: ${Object.keys(oldIdToNewId).length}/${oldUsers.length}`);
    console.log(`   Bets migrated:  ${betsMigrated}/${oldBets.length}`);
    if (Object.keys(oldIdToNewId).length > 0) {
        console.log("\n💡 New User IDs — users must log out and log back in to refresh their session:");
        for (const [oldId, newId] of Object.entries(oldIdToNewId)) {
            const user = oldUsers.find(u => u._id === oldId);
            console.log(`   ${user?.username}: ${newId}`);
        }
    }
}

migrate().catch(console.error);
