// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'caja.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Caja _$CajaFromJson(Map<String, dynamic> json) => _Caja(
  id: json['id'] as String,
  nombre: json['nombre'] as String,
  esPrincipal: json['esPrincipal'] as bool? ?? false,
  orden: (json['orden'] as num?)?.toInt() ?? 0,
  activo: json['activo'] as bool? ?? true,
  saldoManualCentavos: (json['saldoManualCentavos'] as num?)?.toInt(),
);

Map<String, dynamic> _$CajaToJson(_Caja instance) => <String, dynamic>{
  'id': instance.id,
  'nombre': instance.nombre,
  'esPrincipal': instance.esPrincipal,
  'orden': instance.orden,
  'activo': instance.activo,
  'saldoManualCentavos': instance.saldoManualCentavos,
};

_CajaSesion _$CajaSesionFromJson(Map<String, dynamic> json) => _CajaSesion(
  id: json['id'] as String,
  cajaId: json['cajaId'] as String,
  abiertaPorUserId: json['abiertaPorUserId'] as String,
  cerradaPorUserId: json['cerradaPorUserId'] as String?,
  fondoInicialCentavos: (json['fondoInicialCentavos'] as num).toInt(),
  fechaApertura: DateTime.parse(json['fechaApertura'] as String),
  fechaCierre: json['fechaCierre'] == null
      ? null
      : DateTime.parse(json['fechaCierre'] as String),
  efectivoEsperadoCentavos: (json['efectivoEsperadoCentavos'] as num?)?.toInt(),
  efectivoContadoCentavos: (json['efectivoContadoCentavos'] as num?)?.toInt(),
  diferenciaCentavos: (json['diferenciaCentavos'] as num?)?.toInt(),
  nota: json['nota'] as String?,
  estado: json['estado'] as String,
);

Map<String, dynamic> _$CajaSesionToJson(_CajaSesion instance) =>
    <String, dynamic>{
      'id': instance.id,
      'cajaId': instance.cajaId,
      'abiertaPorUserId': instance.abiertaPorUserId,
      'cerradaPorUserId': instance.cerradaPorUserId,
      'fondoInicialCentavos': instance.fondoInicialCentavos,
      'fechaApertura': instance.fechaApertura.toIso8601String(),
      'fechaCierre': instance.fechaCierre?.toIso8601String(),
      'efectivoEsperadoCentavos': instance.efectivoEsperadoCentavos,
      'efectivoContadoCentavos': instance.efectivoContadoCentavos,
      'diferenciaCentavos': instance.diferenciaCentavos,
      'nota': instance.nota,
      'estado': instance.estado,
    };
