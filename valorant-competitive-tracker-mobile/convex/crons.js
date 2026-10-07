import { cronJobs } from "convex/server";
import { internal, api } from "./_generated/api";
import { internalMutation } from "./_generated/server";

export const checkUpcomingMatches = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now();
        const thirtyMinsFromNow = now + 30 * 60 * 1000;
        
        // Convert to match.time string format logic (we can just fetch all upcoming matches)
        const upcomingMatches = await ctx.db
            .query("matches")
            .withIndex("by_status", (q) => q.eq("status", "upcoming"))
            .collect();
            
        for (const match of upcomingMatches) {
            // match.time is like "2024-03-12 15:00:00" in UTC
            const matchTimeStr = match.time.replace(' ', 'T') + 'Z'; 
            const matchTimeMs = new Date(matchTimeStr).getTime();
            
            if (isNaN(matchTimeMs)) continue;

            const timeDiff = matchTimeMs - now;
            
            // Check if it's within the next 30-35 mins window
            if (timeDiff > 25 * 60 * 1000 && timeDiff <= 35 * 60 * 1000) {
                // If we haven't notified for this match yet
                if (!match.notified) {
                    const allUsers = await ctx.db.query("users").collect();
                    for (const user of allUsers) {
                        const isFav = user.favoriteTeams && 
                            (user.favoriteTeams.includes(match.team1.name) || user.favoriteTeams.includes(match.team1.shortName) || 
                             user.favoriteTeams.includes(match.team2.name) || user.favoriteTeams.includes(match.team2.shortName));
                             
                        if (isFav && user.pushToken) {
                            await ctx.scheduler.runAfter(0, api.expoPush.sendExpoPushNotification, {
                                pushToken: user.pushToken,
                                title: "Upcoming Match!",
                                body: `${match.team1.name} vs ${match.team2.name} is starting in 30 minutes!`,
                            });
                        }
                    }
                    await ctx.db.patch(match._id, { notified: true });
                }
            }
        }
    }
});

const crons = cronJobs();
crons.interval(
    "check upcoming matches",
    { minutes: 5 }, // every 5 minutes
    internal.crons.checkUpcomingMatches
);

export default crons;
