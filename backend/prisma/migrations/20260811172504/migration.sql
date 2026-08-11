-- AlterTable
ALTER TABLE "resumes" ADD COLUMN     "aiSummary" TEXT,
ADD COLUMN     "experience" JSONB,
ADD COLUMN     "fileUrl" TEXT,
ADD COLUMN     "skills" JSONB,
ALTER COLUMN "content" DROP NOT NULL;
