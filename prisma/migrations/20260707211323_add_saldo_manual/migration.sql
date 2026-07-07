-- AlterTable
ALTER TABLE "Caja" ADD COLUMN     "saldoManualActualizadoEn" TIMESTAMP(3),
ADD COLUMN     "saldoManualCentavos" INTEGER;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "saldoMpActualizadoEn" TIMESTAMP(3),
ADD COLUMN     "saldoMpCentavos" INTEGER;
