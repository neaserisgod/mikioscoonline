// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'proveedor.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Proveedor _$ProveedorFromJson(Map<String, dynamic> json) => _Proveedor(
  id: json['id'] as String,
  nombre: json['nombre'] as String,
  activo: json['activo'] as bool? ?? true,
);

Map<String, dynamic> _$ProveedorToJson(_Proveedor instance) =>
    <String, dynamic>{
      'id': instance.id,
      'nombre': instance.nombre,
      'activo': instance.activo,
    };
