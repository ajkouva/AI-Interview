import type { Request, Response } from 'express';
import { getAuth } from '@clerk/express';
import userService from '../services/user.services';

async function me(req: Request, res: Response) {
    const { userId } = getAuth(req);
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const user = await userService.me(userId);
        if (!user) {
            return res.json({
                user: null,
                needsOnboarding: true,
            });
        }
        return res.json({
            user,
            needsOnboarding: !user.isOnboarded,
        });
    } catch (error) {
        return res.status(500).json({ error: 'Internal server error while fetching user profile' });
    }
}

async function onboarding(req: Request, res: Response) {
    const { userId } = getAuth(req);
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { fullName, college, bio, targetRole, experienceLevel, avatarUrl } = req.body;

    try {
        const updatedUser = await userService.onboarding(userId, {
            fullName,
            college,
            bio,
            targetRole,
            experienceLevel,
            avatarUrl,
        });

        return res.json({
            message: 'Onboarding completed successfully!',
            user: updatedUser,
        });
    } catch (error: any) {
        console.error("Onboarding error:", error);
        return res.status(500).json({ error: 'Failed to complete onboarding', details: error.message || error });
    }
}

export default {
    me,
    onboarding,
};