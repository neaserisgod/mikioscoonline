// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sale.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_SaleLine _$SaleLineFromJson(Map<String, dynamic> json) => _SaleLine(
  id: json['id'] as String?,
  productId: json['productId'] as String,
  cantidad: (json['cantidad'] as num).toInt(),
  gramos: (json['gramos'] as num?)?.toInt(),
  precioUnitarioCentavos: (json['precioUnitarioCentavos'] as num).toInt(),
  costoUnitarioCentavos: (json['costoUnitarioCentavos'] as num).toInt(),
);

Map<String, dynamic> _$SaleLineToJson(_SaleLine instance) => <String, dynamic>{
  'id': instance.id,
  'productId': instance.productId,
  'cantidad': instance.cantidad,
  'gramos': instance.gramos,
  'precioUnitarioCentavos': instance.precioUnitarioCentavos,
  'costoUnitarioCentavos': instance.costoUnitarioCentavos,
};

_PaymentInput _$PaymentInputFromJson(Map<String, dynamic> json) =>
    _PaymentInput(
      paymentMethodId: json['paymentMethodId'] as String,
      montoCentavos: (json['montoCentavos'] as num).toInt(),
    );

Map<String, dynamic> _$PaymentInputToJson(_PaymentInput instance) =>
    <String, dynamic>{
      'paymentMethodId': instance.paymentMethodId,
      'montoCentavos': instance.montoCentavos,
    };

_Sale _$SaleFromJson(Map<String, dynamic> json) => _Sale(
  id: json['id'] as String,
  fecha: DateTime.parse(json['fecha'] as String),
  userId: json['userId'] as String,
  totalCentavos: (json['totalCentavos'] as num).toInt(),
  costoTotalCentavos: (json['costoTotalCentavos'] as num).toInt(),
  recargoCentavos: (json['recargoCentavos'] as num?)?.toInt() ?? 0,
  descuentoCentavos: (json['descuentoCentavos'] as num?)?.toInt() ?? 0,
  lines:
      (json['lines'] as List<dynamic>?)
          ?.map((e) => SaleLine.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
);

Map<String, dynamic> _$SaleToJson(_Sale instance) => <String, dynamic>{
  'id': instance.id,
  'fecha': instance.fecha.toIso8601String(),
  'userId': instance.userId,
  'totalCentavos': instance.totalCentavos,
  'costoTotalCentavos': instance.costoTotalCentavos,
  'recargoCentavos': instance.recargoCentavos,
  'descuentoCentavos': instance.descuentoCentavos,
  'lines': instance.lines,
};
