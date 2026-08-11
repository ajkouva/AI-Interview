import { prisma } from "../config/db";
import ImageKit from "imagekit";

const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY as string,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY as string,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT as string,
});

async function uploadResume(clerkId: string, title: string, file: Express.Multer.File) {
    const user = await prisma.user.findUnique({
        where: { clerkId }
    });
    if (!user){
        const error = new Error("User not found") as any;
        error.statusCode = 404;
        throw error;
    }
    
    const uploadResponse = await imagekit.upload({
        file:file.buffer,
        fileName:file.originalname,
        folder:"/ai-interviews/resumes",
    });

    const resume = await prisma.resume.create({
        data : {
            title: title,
            fileUrl:uploadResponse.url,
            userId:user.id,
        }
    });
    return resume;

}

async function getAllResumes(clerkId: string) {
    const user = await prisma.user.findUnique({
        where: { clerkId }
    });
    if (!user){
        const error = new Error("User not found") as any;
        error.statusCode = 404;
        throw error;
    }

    const resumes = await prisma.resume.findMany({
        where: { userId: user.id }
    });
    return resumes;
}

export default {
    uploadResume,
    getAllResumes
}