-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('TRIAL', 'ACTIVO', 'VENCIDO', 'CANCELADO');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "estadoPago" "EstadoPago" NOT NULL DEFAULT 'TRIAL',
ADD COLUMN     "trialTerminaEl" TIMESTAMP(3),
ADD COLUMN     "mpPreapprovalId" TEXT;
