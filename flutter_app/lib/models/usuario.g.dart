// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'usuario.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Usuario _$UsuarioFromJson(Map<String, dynamic> json) => _Usuario(
  id: json['id'] as String,
  email: json['email'] as String,
  nombre: json['nombre'] as String,
  role: $enumDecode(_$RoleEnumMap, json['role']),
  organizationId: json['organizationId'] as String,
);

Map<String, dynamic> _$UsuarioToJson(_Usuario instance) => <String, dynamic>{
  'id': instance.id,
  'email': instance.email,
  'nombre': instance.nombre,
  'role': _$RoleEnumMap[instance.role]!,
  'organizationId': instance.organizationId,
};

const _$RoleEnumMap = {Role.admin: 'ADMIN', Role.vendedor: 'VENDEDOR'};
