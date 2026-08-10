import type { Request, Response } from "express";
import { Webhook } from "svix";
import { prisma } from "../config/db";

export const handleClerkWebhook = async (req: Request, res: Response) => {
    const SIGNING_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!SIGNING_SECRET) {
        return res.status(500).json({
            error: "Missing CLERK_WEBHOOK_SECRET in environment variables"
        });
    }

    const svix_id = req.headers["svix-id"] as string;
    const svix_timestamp = req.headers["svix-timestamp"] as string;
    const svix_signature = req.headers["svix-signature"] as string;

    if (!svix_id || !svix_signature || !svix_timestamp) {
        return res.status(400).json({
            error: "Missing Svix verification headers"
        })
    }

    // When using express.raw(), req.body is a Buffer
    const payloadBuffer = req.body;
    let body = "";
    
    if (Buffer.isBuffer(payloadBuffer)) {
        body = payloadBuffer.toString('utf8');
    } else {
        // Fallback just in case
        body = JSON.stringify(payloadBuffer);
    }

    const wh = new Webhook(SIGNING_SECRET);
    let evt: any;

    try {
        evt = wh.verify(body, {
            "svix-id": svix_id,
            "svix-timestamp": svix_timestamp,
            "svix-signature": svix_signature
        });
    } catch (e) {
        console.log("webhook verification failed ,", e);
        return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const eventType = evt.type;

    try {
        if (eventType === 'user.deleted') {
            const { id } = evt.data;
            if (id) {
                await prisma.user.deleteMany({
                    where: { clerkId: id }
                });
                console.log(`User ${id} deleted from PostgreSQL database!`);
            }
            return res.status(200).json({ success: true });
        }

        if (eventType === 'user.created' || eventType === 'user.updated') {
            const { id, email_addresses, username, first_name, last_name, image_url, external_accounts } = evt.data;
            const primaryEmail = email_addresses?.[0]?.email_address;
            const fullName = [first_name, last_name].filter(Boolean).join(' ') || null;

            const provider = external_accounts?.[0]?.provider || 'email';

            await prisma.user.upsert({
                where: { clerkId: id },
                update: {
                    email: primaryEmail,
                    username: username || undefined,
                    avatarUrl: image_url,
                },
                create: {
                    clerkId: id,
                    email: primaryEmail || `unknown-${id}@placeholder.com`, // Fallback for email
                    username: username || undefined,
                    fullName: fullName,
                    avatarUrl: image_url,
                    authProvider: provider,
                    isOnboarded: false, 
                },
            });
            console.log(`User ${id} synced to PostgreSQL database!`);
        }
        return res.status(200).json({ success: true });
    } catch (error: any) {
        console.error("Webhook processing error:", error.message || error);
        return res.status(500).json({ error: "Internal server error processing webhook" });
    }
}

