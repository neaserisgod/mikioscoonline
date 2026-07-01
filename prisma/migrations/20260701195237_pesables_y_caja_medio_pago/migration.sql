-- AlterTable
ALTER TABLE "PaymentMethod" ADD COLUMN     "cajaId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "costoPorKgCentavos" INTEGER,
ADD COLUMN     "esPesable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "precioPorKgCentavos" INTEGER,
ADD COLUMN     "stockGramos" INTEGER,
ADD COLUMN     "stockMinimoGramos" INTEGER;

-- AlterTable
ALTER TABLE "SaleLine" ADD COLUMN     "gramos" INTEGER;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "gramos" INTEGER,
ADD COLUMN     "gramosAnterior" INTEGER,
ADD COLUMN     "gramosPosterior" INTEGER;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "Caja"("id") ON DELETE SET NULL ON UPDATE CASCADE;
