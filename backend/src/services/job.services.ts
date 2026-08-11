import { prisma } from "../config/db";

export interface JobInput {
    title: string,
    description: string
}

async function createJob(clerkId: string, data: JobInput) {
    const userId = await prisma.user.findUniqueOrThrow({
        where: {
            clerkId: clerkId
        }
    })

    if (!userId) {
        throw new Error("User not found in DB");
    }

    const job = await prisma.jobDescription.create({
        data:{
            title:data.title,
            description:data.description,
            userId:userId.id
        }
    })
    return job;
}

async function getAllJobs(clerkId:string){
    const user = await prisma.user.findUniqueOrThrow({
        where:{
            clerkId:clerkId
        }
    })

    if(!user){
        throw new Error("User not found in DB");
    }

    return await prisma.jobDescription.findMany({
        where:{
            userId:user.id
        },
        orderBy:{
            createdAt:"desc"
        }
    })
}

async function getJobById(jobId:string,clerkId:string){
    const user = await prisma.user.findUniqueOrThrow({
        where:{
            clerkId:clerkId
        }
    })

    if(!user){
        throw new Error("User not found in DB");
    }

    const job = await prisma.jobDescription.findUnique({
        where:{
            id:jobId
        }
    })

    if(!job || job.userId !== user.id){
        return null;
    }

    return job;
}

export default{
    createJob,
    getAllJobs,
    getJobById
}