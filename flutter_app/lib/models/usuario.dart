import 'package:freezed_annotation/freezed_annotation.dart';

part 'usuario.freezed.dart';
part 'usuario.g.dart';

enum Role {
  @JsonValue('ADMIN')
  admin,
  @JsonValue('VENDEDOR')
  vendedor,
}

@freezed
abstract class Usuario with _$Usuario {
  const factory Usuario({
    required String id,
    required String email,
    required String nombre,
    required Role role,
    required String organizationId,
  }) = _Usuario;

  factory Usuario.fromJson(Map<String, dynamic> json) => _$UsuarioFromJson(json);
}
