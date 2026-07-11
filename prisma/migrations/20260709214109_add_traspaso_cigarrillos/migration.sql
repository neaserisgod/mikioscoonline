-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "traspasoCigarrillosCentavos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "traspasoCigarrillosConfirmado" BOOLEAN NOT NULL DEFAULT false;
