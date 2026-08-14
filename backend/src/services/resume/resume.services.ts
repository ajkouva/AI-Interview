import { prisma } from "../../config/db";
import ImageKit from "imagekit";
import { parsePDF, parseResumeWithAI } from "./resume.parser";

const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY as string,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY as string,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT as string,
});

async function uploadResume(clerkId: string, userTitle: string | undefined, file: Express.Multer.File) {
    const user = await prisma.user.findUnique({
        where: { clerkId }
    });
    if (!user) {
        const error = new Error("User not found") as any;
        error.statusCode = 404;
        throw error;
    }

    let uploadResponse: any = null;

    try {
        uploadResponse = await imagekit.upload({
            file: file.buffer,
            fileName: file.originalname,
            folder: "/ai-interviews/resumes",
            isPrivateFile: true
        });

        const rawText = await parsePDF(file.buffer);
        const aiData = await parseResumeWithAI(rawText);

        if (!aiData) {
            const error = new Error("Failed to parse resume with AI") as any;
            error.statusCode = 500;
            throw error;
        }

        const computedTitle = userTitle || (aiData.name ? `${aiData.name} ${aiData.title ? `- ${aiData.title}` : ''}` : file.originalname);

        const resume = await prisma.resume.create({
            data: {
                title: computedTitle,
                fileId: uploadResponse.fileId,
                fileUrl: uploadResponse.filePath,
                fileName: uploadResponse.name,
                userId: user.id,
                content: rawText,
                aiSummary: aiData.aiSummary,
                skills: aiData.skills ?? [],
                experience: aiData.experience ?? [],
                education: aiData.education ?? [],
                projects: aiData.projects ?? [],
                certifications: aiData.certifications ?? [],
                contact: (aiData.contact as any) ?? {}
            }
        });

        const signedUrl = imagekit.url({
            path: uploadResponse.filePath,
            signed: true,
            expireSeconds: 300
        });

        return { ...resume, fileUrl: signedUrl };

    } catch (err: any) {
        if (uploadResponse?.fileId) {
            try {
                await imagekit.deleteFile(uploadResponse.fileId);
            } catch (cleanupErr) {
                console.error("Failed to clean up ImageKit file after upload error:", cleanupErr);
            }
        }
        throw err;
    }
}

async function getAllResumes(clerkId: string) {
    const user = await prisma.user.findUnique({
        where: { clerkId }
    });
    if (!user) {
        const error = new Error("User not found") as any;
        error.statusCode = 404;
        throw error;
    }

    const resumes = await prisma.resume.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' }
    });

    return resumes.map(resume => {
        if (!resume.fileUrl) return resume;
        const signedUrl = imagekit.url({
            path: resume.fileUrl,
            signed: true,
            expireSeconds: 300
        });
        return { ...resume, fileUrl: signedUrl };
    });
}

async function getResumeById(clerkId: string, id: string) {
    const user = await prisma.user.findUnique({
        where: { clerkId }
    });
    if (!user) {
        const error = new Error("User not found") as any;
        error.statusCode = 404;
        throw error;
    }

    const resume = await prisma.resume.findFirst({
        where: { id, userId: user.id }
    });

    if (!resume) {
        const error = new Error("Resume not found") as any;
        error.statusCode = 404;
        throw error;
    }

    const signedUrl = resume.fileUrl ? imagekit.url({
        path: resume.fileUrl,
        signed: true,
        expireSeconds: 300
    }) : null;

    return { ...resume, fileUrl: signedUrl };
}

async function deleteResume(clerkId: string, id: string) {
    const user = await prisma.user.findUnique({
        where: { clerkId }
    });
    if (!user) {
        const error = new Error("User not found") as any;
        error.statusCode = 404;
        throw error;
    }

    const resume = await prisma.resume.findFirst({
        where: { id, userId: user.id }
    });

    if (!resume) {
        const error = new Error("Resume not found") as any;
        error.statusCode = 404;
        throw error;
    }

    // 1. Delete from ImageKit FIRST - throw if deletion fails
    if (resume.fileId) {
        await imagekit.deleteFile(resume.fileId);
    }

    // 2. Delete from DB
    await prisma.resume.delete({
        where: { id: resume.id }
    });

    return { message: "Resume deleted successfully" };
}

export default {
    uploadResume,
    getAllResumes,
    getResumeById,
    deleteResume
};