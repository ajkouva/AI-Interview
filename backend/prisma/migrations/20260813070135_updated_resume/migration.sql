/*
  Warnings:

  - Added the required column `fileId` to the `resumes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileName` to the `resumes` table without a default value. This is not possible if the table is not empty.
  - Made the column `fileUrl` on table `resumes` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "resumes" ADD COLUMN     "contact" JSONB,
ADD COLUMN     "education" JSONB,
ADD COLUMN     "fileId" TEXT NOT NULL,
ADD COLUMN     "fileName" TEXT NOT NULL,
ADD COLUMN     "projects" JSONB,
ALTER COLUMN "fileUrl" SET NOT NULL;
