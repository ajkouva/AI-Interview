-- AlterTable
ALTER TABLE "users" ADD COLUMN     "authProvider" TEXT DEFAULT 'email',
ALTER COLUMN "username" DROP NOT NULL;
