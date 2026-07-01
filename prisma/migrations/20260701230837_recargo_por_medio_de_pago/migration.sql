-- AlterTable
ALTER TABLE "Caja" DROP COLUMN "recargoTipo",
DROP COLUMN "recargoVirtualBp",
DROP COLUMN "recargoVirtualFijoCentavos";

-- AlterTable
ALTER TABLE "PaymentMethod" ADD COLUMN     "recargoTipo" TEXT NOT NULL DEFAULT 'PORCENTUAL',
ADD COLUMN     "recargoVirtualBp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "recargoVirtualFijoCentavos" INTEGER NOT NULL DEFAULT 0;
