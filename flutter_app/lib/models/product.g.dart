// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'product.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Product _$ProductFromJson(Map<String, dynamic> json) => _Product(
  id: json['id'] as String,
  sku: json['sku'] as String,
  barcode: json['barcode'] as String?,
  nombre: json['nombre'] as String,
  costoCentavos: (json['costoCentavos'] as num).toInt(),
  precioCentavos: (json['precioCentavos'] as num).toInt(),
  costoEsProvisional: json['costoEsProvisional'] as bool? ?? false,
  categoryId: json['categoryId'] as String,
  providerId: json['providerId'] as String?,
  locationId: json['locationId'] as String?,
  stock: (json['stock'] as num?)?.toInt() ?? 0,
  stockMinimo: (json['stockMinimo'] as num?)?.toInt() ?? 0,
  esPesable: json['esPesable'] as bool? ?? false,
  costoPorKgCentavos: (json['costoPorKgCentavos'] as num?)?.toInt(),
  precioPorKgCentavos: (json['precioPorKgCentavos'] as num?)?.toInt(),
  stockGramos: (json['stockGramos'] as num?)?.toInt(),
  stockMinimoGramos: (json['stockMinimoGramos'] as num?)?.toInt(),
  activo: json['activo'] as bool? ?? true,
);

Map<String, dynamic> _$ProductToJson(_Product instance) => <String, dynamic>{
  'id': instance.id,
  'sku': instance.sku,
  'barcode': instance.barcode,
  'nombre': instance.nombre,
  'costoCentavos': instance.costoCentavos,
  'precioCentavos': instance.precioCentavos,
  'costoEsProvisional': instance.costoEsProvisional,
  'categoryId': instance.categoryId,
  'providerId': instance.providerId,
  'locationId': instance.locationId,
  'stock': instance.stock,
  'stockMinimo': instance.stockMinimo,
  'esPesable': instance.esPesable,
  'costoPorKgCentavos': instance.costoPorKgCentavos,
  'precioPorKgCentavos': instance.precioPorKgCentavos,
  'stockGramos': instance.stockGramos,
  'stockMinimoGramos': instance.stockMinimoGramos,
  'activo': instance.activo,
};
