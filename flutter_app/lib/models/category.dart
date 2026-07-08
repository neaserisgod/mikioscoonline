import 'package:freezed_annotation/freezed_annotation.dart';

part 'category.freezed.dart';
part 'category.g.dart';

@freezed
abstract class Category with _$Category {
  const factory Category({
    required String id,
    required String nombre,
    required int markupDefaultBp,
    required String markupDefaultTipo,
    @Default(0) int markupDefaultFijoCentavos,
    @Default(true) bool activo,
    String? cajaId,
  }) = _Category;

  factory Category.fromJson(Map<String, dynamic> json) => _$CategoryFromJson(json);
}
