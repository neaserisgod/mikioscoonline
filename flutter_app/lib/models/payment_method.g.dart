// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'payment_method.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PaymentMethod _$PaymentMethodFromJson(Map<String, dynamic> json) =>
    _PaymentMethod(
      id: json['id'] as String,
      nombre: json['nombre'] as String,
      comisionBp: (json['comisionBp'] as num?)?.toInt() ?? 0,
      esMercadoPago: json['esMercadoPago'] as bool? ?? false,
      esEfectivo: json['esEfectivo'] as bool? ?? false,
      activo: json['activo'] as bool? ?? true,
      esDefault: json['esDefault'] as bool? ?? false,
      orden: (json['orden'] as num?)?.toInt() ?? 0,
      cajaId: json['cajaId'] as String?,
      mpExternalPosId: json['mpExternalPosId'] as String?,
      mpTerminalId: json['mpTerminalId'] as String?,
      recargoTipo: json['recargoTipo'] as String? ?? 'PORCENTUAL',
      recargoVirtualBp: (json['recargoVirtualBp'] as num?)?.toInt() ?? 0,
      recargoVirtualFijoCentavos:
          (json['recargoVirtualFijoCentavos'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$PaymentMethodToJson(_PaymentMethod instance) =>
    <String, dynamic>{
      'id': instance.id,
      'nombre': instance.nombre,
      'comisionBp': instance.comisionBp,
      'esMercadoPago': instance.esMercadoPago,
      'esEfectivo': instance.esEfectivo,
      'activo': instance.activo,
      'esDefault': instance.esDefault,
      'orden': instance.orden,
      'cajaId': instance.cajaId,
      'mpExternalPosId': instance.mpExternalPosId,
      'mpTerminalId': instance.mpTerminalId,
      'recargoTipo': instance.recargoTipo,
      'recargoVirtualBp': instance.recargoVirtualBp,
      'recargoVirtualFijoCentavos': instance.recargoVirtualFijoCentavos,
    };
