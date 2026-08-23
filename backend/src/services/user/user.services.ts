import { prisma } from "../../config/db";

export interface OnboardingData {
    fullName?: string;
    college?: string;
    bio?: string;
    targetRole?: string;
    experienceLevel?: string;
    avatarUrl?: string;
}

async function me(userId: string) {
    try {
        const user = await prisma.user.findUnique({
            where: {
                clerkId: userId,
            },
        });
        return user;
    } catch (error) {
        console.error('Error while fetching user from db: ', error);
        throw error;
    }
}

async function onboarding(userId: string, data: OnboardingData) {
    try {
        const existingUser = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true } });
        if (!existingUser) {
            const error = new Error("Your account is still being synchronized. Please retry in a moment.") as any;
            error.statusCode = 409;
            throw error;
        }
        const user = await prisma.user.update({
            where: {
                clerkId: userId,
            },
            data: {
                ...data,
                isOnboarded: true,
            },
        });
        return user;
    } catch (error) {
        console.error('Error while updating user onboarding in db: ', error);
        throw error;
    }
}

export default {
    me,
    onboarding,
};
