import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";

export const sendExpoPushNotification = action({
    args: { pushToken: v.string(), title: v.string(), body: v.string(), data: v.optional(v.any()) },
    handler: async (ctx, args) => {
        const message = {
            to: args.pushToken,
            sound: 'default',
            title: args.title,
            body: args.body,
            data: args.data || {},
        };

        try {
            await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(message),
            });
        } catch (e) {
            console.error("Error sending push notification", e);
        }
    },
});
