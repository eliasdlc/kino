import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./src/shared/db";
import * as schema from "./src/shared/db/schema";

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema,

    }),
    // Better Auth's "user" model → our "users" table
    user: {
        modelName: "users",
        fields: {
            name: "full_name",
            image: "avatar_url",
            emailVerified: "email_verified",
        },
        additionalFields: {
            onboardingCompleted: {
                type: "boolean",
                required: false,
                defaultValue: false,
                input: false,
            },
            xpTotal: {
                type: "number",
                required: false,
                defaultValue: 0,
                input: false,
            },
            coins: {
                type: "number",
                required: false,
                defaultValue: 0,
                input: false,
            },
            timezone: {
                type: "string",
                required: false,
                defaultValue: "America/Santo_Domingo",
            },
            status: {
                type: "string",
                required: false,
                defaultValue: "active",
                input: false,
            },
            provider: {
                type: "string",
                required: false,
                defaultValue: "local",
                input: false,
            },
            providerId: {
                type: "string",
                required: false,
                input: false,
            },
            lastSyncDate: {
                type: "date",
                required: false,
                input: false,
            },
        },
    },

    session: {
        modelName: "sessions",
    },

    // Better Auth manages OAuth accounts separately from the user table.
    // This is the "accounts" table in our schema.
    account: {
        modelName: "accounts",
    },

    verification: {
        modelName: "verifications",
    },

    emailAndPassword: {
        enabled: true,
    },

    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
        github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        },
    },

    advanced: {
        database: {
            generateId: false,
        },
    },
});