// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'category.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Category _$CategoryFromJson(Map<String, dynamic> json) => _Category(
  id: json['id'] as String,
  nombre: json['nombre'] as String,
  markupDefaultBp: (json['markupDefaultBp'] as num).toInt(),
  markupDefaultTipo: json['markupDefaultTipo'] as String,
  markupDefaultFijoCentavos:
      (json['markupDefaultFijoCentavos'] as num?)?.toInt() ?? 0,
  activo: json['activo'] as bool? ?? true,
  cajaId: json['cajaId'] as String?,
);

Map<String, dynamic> _$CategoryToJson(_Category instance) => <String, dynamic>{
  'id': instance.id,
  'nombre': instance.nombre,
  'markupDefaultBp': instance.markupDefaultBp,
  'markupDefaultTipo': instance.markupDefaultTipo,
  'markupDefaultFijoCentavos': instance.markupDefaultFijoCentavos,
  'activo': instance.activo,
  'cajaId': instance.cajaId,
};
