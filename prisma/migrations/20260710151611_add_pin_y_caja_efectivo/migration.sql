-- AlterTable
ALTER TABLE "Caja" ADD COLUMN     "manejaEfectivo" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pinHash" TEXT,
ALTER COLUMN "email" DROP NOT NULL;
