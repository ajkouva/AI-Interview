import type { Request, Response } from 'express';
import { getClerkUserId } from '../middlewares/auth';
import userService from '../services/user/user.services';
import { asyncHandler } from '../middlewares/asyncHandler';

const me = asyncHandler(async (req: Request, res: Response) => {
    const userId = getClerkUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await userService.me(userId);
    if (!user) {
        return res.status(200).json({
            user: null,
            needsOnboarding: true,
        });
    }

    return res.status(200).json({
        user,
        needsOnboarding: !user.isOnboarded,
    });
});

const onboarding = asyncHandler(async (req: Request, res: Response) => {
    const userId = getClerkUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { fullName, college, bio, targetRole, experienceLevel, avatarUrl } = req.body;

    if (fullName !== undefined && typeof fullName !== 'string')
        return res.status(400).json({ error: 'Invalid fullName' });
    if (college !== undefined && typeof college !== 'string')
        return res.status(400).json({ error: 'Invalid college' });
    if (bio !== undefined && typeof bio !== 'string')
        return res.status(400).json({ error: 'Invalid bio' });
    if (targetRole !== undefined && typeof targetRole !== 'string')
        return res.status(400).json({ error: 'Invalid targetRole' });
    if (experienceLevel !== undefined && typeof experienceLevel !== 'string')
        return res.status(400).json({ error: 'Invalid experienceLevel' });
    if (avatarUrl !== undefined && typeof avatarUrl !== 'string')
        return res.status(400).json({ error: 'Invalid avatarUrl' });

    const textFields = { fullName, college, bio, targetRole, experienceLevel };
    for (const [field, value] of Object.entries(textFields)) {
        if (typeof value === 'string' && value.trim().length === 0) {
            return res.status(400).json({ error: `${field} cannot be blank` });
        }
    }
    if ((fullName?.length ?? 0) > 120 || (college?.length ?? 0) > 200 || (bio?.length ?? 0) > 2_000 ||
        (targetRole?.length ?? 0) > 120 || (experienceLevel?.length ?? 0) > 60 || (avatarUrl?.length ?? 0) > 2_000) {
        return res.status(400).json({ error: 'One or more profile fields exceed the allowed length' });
    }

    const updatedUser = await userService.onboarding(userId, {
        fullName,
        college,
        bio,
        targetRole,
        experienceLevel,
        avatarUrl,
    });

    return res.status(200).json({
        message: 'Onboarding completed successfully!',
        user: updatedUser,
    });
});

export default {
    me,
    onboarding,
};
