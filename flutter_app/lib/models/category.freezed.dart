// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'category.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$Category {

 String get id; String get nombre; int get markupDefaultBp; String get markupDefaultTipo; int get markupDefaultFijoCentavos; bool get activo; String? get cajaId;
/// Create a copy of Category
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CategoryCopyWith<Category> get copyWith => _$CategoryCopyWithImpl<Category>(this as Category, _$identity);

  /// Serializes this Category to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Category&&(identical(other.id, id) || other.id == id)&&(identical(other.nombre, nombre) || other.nombre == nombre)&&(identical(other.markupDefaultBp, markupDefaultBp) || other.markupDefaultBp == markupDefaultBp)&&(identical(other.markupDefaultTipo, markupDefaultTipo) || other.markupDefaultTipo == markupDefaultTipo)&&(identical(other.markupDefaultFijoCentavos, markupDefaultFijoCentavos) || other.markupDefaultFijoCentavos == markupDefaultFijoCentavos)&&(identical(other.activo, activo) || other.activo == activo)&&(identical(other.cajaId, cajaId) || other.cajaId == cajaId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,nombre,markupDefaultBp,markupDefaultTipo,markupDefaultFijoCentavos,activo,cajaId);

@override
String toString() {
  return 'Category(id: $id, nombre: $nombre, markupDefaultBp: $markupDefaultBp, markupDefaultTipo: $markupDefaultTipo, markupDefaultFijoCentavos: $markupDefaultFijoCentavos, activo: $activo, cajaId: $cajaId)';
}


}

/// @nodoc
abstract mixin class $CategoryCopyWith<$Res>  {
  factory $CategoryCopyWith(Category value, $Res Function(Category) _then) = _$CategoryCopyWithImpl;
@useResult
$Res call({
 String id, String nombre, int markupDefaultBp, String markupDefaultTipo, int markupDefaultFijoCentavos, bool activo, String? cajaId
});




}
/// @nodoc
class _$CategoryCopyWithImpl<$Res>
    implements $CategoryCopyWith<$Res> {
  _$CategoryCopyWithImpl(this._self, this._then);

  final Category _self;
  final $Res Function(Category) _then;

/// Create a copy of Category
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? nombre = null,Object? markupDefaultBp = null,Object? markupDefaultTipo = null,Object? markupDefaultFijoCentavos = null,Object? activo = null,Object? cajaId = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,nombre: null == nombre ? _self.nombre : nombre // ignore: cast_nullable_to_non_nullable
as String,markupDefaultBp: null == markupDefaultBp ? _self.markupDefaultBp : markupDefaultBp // ignore: cast_nullable_to_non_nullable
as int,markupDefaultTipo: null == markupDefaultTipo ? _self.markupDefaultTipo : markupDefaultTipo // ignore: cast_nullable_to_non_nullable
as String,markupDefaultFijoCentavos: null == markupDefaultFijoCentavos ? _self.markupDefaultFijoCentavos : markupDefaultFijoCentavos // ignore: cast_nullable_to_non_nullable
as int,activo: null == activo ? _self.activo : activo // ignore: cast_nullable_to_non_nullable
as bool,cajaId: freezed == cajaId ? _self.cajaId : cajaId // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [Category].
extension CategoryPatterns on Category {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Category value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Category() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Category value)  $default,){
final _that = this;
switch (_that) {
case _Category():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Category value)?  $default,){
final _that = this;
switch (_that) {
case _Category() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String nombre,  int markupDefaultBp,  String markupDefaultTipo,  int markupDefaultFijoCentavos,  bool activo,  String? cajaId)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Category() when $default != null:
return $default(_that.id,_that.nombre,_that.markupDefaultBp,_that.markupDefaultTipo,_that.markupDefaultFijoCentavos,_that.activo,_that.cajaId);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String nombre,  int markupDefaultBp,  String markupDefaultTipo,  int markupDefaultFijoCentavos,  bool activo,  String? cajaId)  $default,) {final _that = this;
switch (_that) {
case _Category():
return $default(_that.id,_that.nombre,_that.markupDefaultBp,_that.markupDefaultTipo,_that.markupDefaultFijoCentavos,_that.activo,_that.cajaId);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String nombre,  int markupDefaultBp,  String markupDefaultTipo,  int markupDefaultFijoCentavos,  bool activo,  String? cajaId)?  $default,) {final _that = this;
switch (_that) {
case _Category() when $default != null:
return $default(_that.id,_that.nombre,_that.markupDefaultBp,_that.markupDefaultTipo,_that.markupDefaultFijoCentavos,_that.activo,_that.cajaId);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Category implements Category {
  const _Category({required this.id, required this.nombre, required this.markupDefaultBp, required this.markupDefaultTipo, this.markupDefaultFijoCentavos = 0, this.activo = true, this.cajaId});
  factory _Category.fromJson(Map<String, dynamic> json) => _$CategoryFromJson(json);

@override final  String id;
@override final  String nombre;
@override final  int markupDefaultBp;
@override final  String markupDefaultTipo;
@override@JsonKey() final  int markupDefaultFijoCentavos;
@override@JsonKey() final  bool activo;
@override final  String? cajaId;

/// Create a copy of Category
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CategoryCopyWith<_Category> get copyWith => __$CategoryCopyWithImpl<_Category>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CategoryToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Category&&(identical(other.id, id) || other.id == id)&&(identical(other.nombre, nombre) || other.nombre == nombre)&&(identical(other.markupDefaultBp, markupDefaultBp) || other.markupDefaultBp == markupDefaultBp)&&(identical(other.markupDefaultTipo, markupDefaultTipo) || other.markupDefaultTipo == markupDefaultTipo)&&(identical(other.markupDefaultFijoCentavos, markupDefaultFijoCentavos) || other.markupDefaultFijoCentavos == markupDefaultFijoCentavos)&&(identical(other.activo, activo) || other.activo == activo)&&(identical(other.cajaId, cajaId) || other.cajaId == cajaId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,nombre,markupDefaultBp,markupDefaultTipo,markupDefaultFijoCentavos,activo,cajaId);

@override
String toString() {
  return 'Category(id: $id, nombre: $nombre, markupDefaultBp: $markupDefaultBp, markupDefaultTipo: $markupDefaultTipo, markupDefaultFijoCentavos: $markupDefaultFijoCentavos, activo: $activo, cajaId: $cajaId)';
}


}

/// @nodoc
abstract mixin class _$CategoryCopyWith<$Res> implements $CategoryCopyWith<$Res> {
  factory _$CategoryCopyWith(_Category value, $Res Function(_Category) _then) = __$CategoryCopyWithImpl;
@override @useResult
$Res call({
 String id, String nombre, int markupDefaultBp, String markupDefaultTipo, int markupDefaultFijoCentavos, bool activo, String? cajaId
});




}
/// @nodoc
class __$CategoryCopyWithImpl<$Res>
    implements _$CategoryCopyWith<$Res> {
  __$CategoryCopyWithImpl(this._self, this._then);

  final _Category _self;
  final $Res Function(_Category) _then;

/// Create a copy of Category
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? nombre = null,Object? markupDefaultBp = null,Object? markupDefaultTipo = null,Object? markupDefaultFijoCentavos = null,Object? activo = null,Object? cajaId = freezed,}) {
  return _then(_Category(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,nombre: null == nombre ? _self.nombre : nombre // ignore: cast_nullable_to_non_nullable
as String,markupDefaultBp: null == markupDefaultBp ? _self.markupDefaultBp : markupDefaultBp // ignore: cast_nullable_to_non_nullable
as int,markupDefaultTipo: null == markupDefaultTipo ? _self.markupDefaultTipo : markupDefaultTipo // ignore: cast_nullable_to_non_nullable
as String,markupDefaultFijoCentavos: null == markupDefaultFijoCentavos ? _self.markupDefaultFijoCentavos : markupDefaultFijoCentavos // ignore: cast_nullable_to_non_nullable
as int,activo: null == activo ? _self.activo : activo // ignore: cast_nullable_to_non_nullable
as bool,cajaId: freezed == cajaId ? _self.cajaId : cajaId // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
