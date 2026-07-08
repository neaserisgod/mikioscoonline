// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'payment_method.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PaymentMethod {

 String get id; String get nombre; int get comisionBp; bool get esMercadoPago; bool get esEfectivo; bool get activo; bool get esDefault; int get orden; String? get cajaId; String? get mpExternalPosId; String? get mpTerminalId; String get recargoTipo; int get recargoVirtualBp; int get recargoVirtualFijoCentavos;
/// Create a copy of PaymentMethod
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PaymentMethodCopyWith<PaymentMethod> get copyWith => _$PaymentMethodCopyWithImpl<PaymentMethod>(this as PaymentMethod, _$identity);

  /// Serializes this PaymentMethod to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PaymentMethod&&(identical(other.id, id) || other.id == id)&&(identical(other.nombre, nombre) || other.nombre == nombre)&&(identical(other.comisionBp, comisionBp) || other.comisionBp == comisionBp)&&(identical(other.esMercadoPago, esMercadoPago) || other.esMercadoPago == esMercadoPago)&&(identical(other.esEfectivo, esEfectivo) || other.esEfectivo == esEfectivo)&&(identical(other.activo, activo) || other.activo == activo)&&(identical(other.esDefault, esDefault) || other.esDefault == esDefault)&&(identical(other.orden, orden) || other.orden == orden)&&(identical(other.cajaId, cajaId) || other.cajaId == cajaId)&&(identical(other.mpExternalPosId, mpExternalPosId) || other.mpExternalPosId == mpExternalPosId)&&(identical(other.mpTerminalId, mpTerminalId) || other.mpTerminalId == mpTerminalId)&&(identical(other.recargoTipo, recargoTipo) || other.recargoTipo == recargoTipo)&&(identical(other.recargoVirtualBp, recargoVirtualBp) || other.recargoVirtualBp == recargoVirtualBp)&&(identical(other.recargoVirtualFijoCentavos, recargoVirtualFijoCentavos) || other.recargoVirtualFijoCentavos == recargoVirtualFijoCentavos));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,nombre,comisionBp,esMercadoPago,esEfectivo,activo,esDefault,orden,cajaId,mpExternalPosId,mpTerminalId,recargoTipo,recargoVirtualBp,recargoVirtualFijoCentavos);

@override
String toString() {
  return 'PaymentMethod(id: $id, nombre: $nombre, comisionBp: $comisionBp, esMercadoPago: $esMercadoPago, esEfectivo: $esEfectivo, activo: $activo, esDefault: $esDefault, orden: $orden, cajaId: $cajaId, mpExternalPosId: $mpExternalPosId, mpTerminalId: $mpTerminalId, recargoTipo: $recargoTipo, recargoVirtualBp: $recargoVirtualBp, recargoVirtualFijoCentavos: $recargoVirtualFijoCentavos)';
}


}

/// @nodoc
abstract mixin class $PaymentMethodCopyWith<$Res>  {
  factory $PaymentMethodCopyWith(PaymentMethod value, $Res Function(PaymentMethod) _then) = _$PaymentMethodCopyWithImpl;
@useResult
$Res call({
 String id, String nombre, int comisionBp, bool esMercadoPago, bool esEfectivo, bool activo, bool esDefault, int orden, String? cajaId, String? mpExternalPosId, String? mpTerminalId, String recargoTipo, int recargoVirtualBp, int recargoVirtualFijoCentavos
});




}
/// @nodoc
class _$PaymentMethodCopyWithImpl<$Res>
    implements $PaymentMethodCopyWith<$Res> {
  _$PaymentMethodCopyWithImpl(this._self, this._then);

  final PaymentMethod _self;
  final $Res Function(PaymentMethod) _then;

/// Create a copy of PaymentMethod
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? nombre = null,Object? comisionBp = null,Object? esMercadoPago = null,Object? esEfectivo = null,Object? activo = null,Object? esDefault = null,Object? orden = null,Object? cajaId = freezed,Object? mpExternalPosId = freezed,Object? mpTerminalId = freezed,Object? recargoTipo = null,Object? recargoVirtualBp = null,Object? recargoVirtualFijoCentavos = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,nombre: null == nombre ? _self.nombre : nombre // ignore: cast_nullable_to_non_nullable
as String,comisionBp: null == comisionBp ? _self.comisionBp : comisionBp // ignore: cast_nullable_to_non_nullable
as int,esMercadoPago: null == esMercadoPago ? _self.esMercadoPago : esMercadoPago // ignore: cast_nullable_to_non_nullable
as bool,esEfectivo: null == esEfectivo ? _self.esEfectivo : esEfectivo // ignore: cast_nullable_to_non_nullable
as bool,activo: null == activo ? _self.activo : activo // ignore: cast_nullable_to_non_nullable
as bool,esDefault: null == esDefault ? _self.esDefault : esDefault // ignore: cast_nullable_to_non_nullable
as bool,orden: null == orden ? _self.orden : orden // ignore: cast_nullable_to_non_nullable
as int,cajaId: freezed == cajaId ? _self.cajaId : cajaId // ignore: cast_nullable_to_non_nullable
as String?,mpExternalPosId: freezed == mpExternalPosId ? _self.mpExternalPosId : mpExternalPosId // ignore: cast_nullable_to_non_nullable
as String?,mpTerminalId: freezed == mpTerminalId ? _self.mpTerminalId : mpTerminalId // ignore: cast_nullable_to_non_nullable
as String?,recargoTipo: null == recargoTipo ? _self.recargoTipo : recargoTipo // ignore: cast_nullable_to_non_nullable
as String,recargoVirtualBp: null == recargoVirtualBp ? _self.recargoVirtualBp : recargoVirtualBp // ignore: cast_nullable_to_non_nullable
as int,recargoVirtualFijoCentavos: null == recargoVirtualFijoCentavos ? _self.recargoVirtualFijoCentavos : recargoVirtualFijoCentavos // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [PaymentMethod].
extension PaymentMethodPatterns on PaymentMethod {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PaymentMethod value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PaymentMethod() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PaymentMethod value)  $default,){
final _that = this;
switch (_that) {
case _PaymentMethod():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PaymentMethod value)?  $default,){
final _that = this;
switch (_that) {
case _PaymentMethod() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String nombre,  int comisionBp,  bool esMercadoPago,  bool esEfectivo,  bool activo,  bool esDefault,  int orden,  String? cajaId,  String? mpExternalPosId,  String? mpTerminalId,  String recargoTipo,  int recargoVirtualBp,  int recargoVirtualFijoCentavos)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PaymentMethod() when $default != null:
return $default(_that.id,_that.nombre,_that.comisionBp,_that.esMercadoPago,_that.esEfectivo,_that.activo,_that.esDefault,_that.orden,_that.cajaId,_that.mpExternalPosId,_that.mpTerminalId,_that.recargoTipo,_that.recargoVirtualBp,_that.recargoVirtualFijoCentavos);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String nombre,  int comisionBp,  bool esMercadoPago,  bool esEfectivo,  bool activo,  bool esDefault,  int orden,  String? cajaId,  String? mpExternalPosId,  String? mpTerminalId,  String recargoTipo,  int recargoVirtualBp,  int recargoVirtualFijoCentavos)  $default,) {final _that = this;
switch (_that) {
case _PaymentMethod():
return $default(_that.id,_that.nombre,_that.comisionBp,_that.esMercadoPago,_that.esEfectivo,_that.activo,_that.esDefault,_that.orden,_that.cajaId,_that.mpExternalPosId,_that.mpTerminalId,_that.recargoTipo,_that.recargoVirtualBp,_that.recargoVirtualFijoCentavos);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String nombre,  int comisionBp,  bool esMercadoPago,  bool esEfectivo,  bool activo,  bool esDefault,  int orden,  String? cajaId,  String? mpExternalPosId,  String? mpTerminalId,  String recargoTipo,  int recargoVirtualBp,  int recargoVirtualFijoCentavos)?  $default,) {final _that = this;
switch (_that) {
case _PaymentMethod() when $default != null:
return $default(_that.id,_that.nombre,_that.comisionBp,_that.esMercadoPago,_that.esEfectivo,_that.activo,_that.esDefault,_that.orden,_that.cajaId,_that.mpExternalPosId,_that.mpTerminalId,_that.recargoTipo,_that.recargoVirtualBp,_that.recargoVirtualFijoCentavos);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PaymentMethod implements PaymentMethod {
  const _PaymentMethod({required this.id, required this.nombre, this.comisionBp = 0, this.esMercadoPago = false, this.esEfectivo = false, this.activo = true, this.esDefault = false, this.orden = 0, this.cajaId, this.mpExternalPosId, this.mpTerminalId, this.recargoTipo = 'PORCENTUAL', this.recargoVirtualBp = 0, this.recargoVirtualFijoCentavos = 0});
  factory _PaymentMethod.fromJson(Map<String, dynamic> json) => _$PaymentMethodFromJson(json);

@override final  String id;
@override final  String nombre;
@override@JsonKey() final  int comisionBp;
@override@JsonKey() final  bool esMercadoPago;
@override@JsonKey() final  bool esEfectivo;
@override@JsonKey() final  bool activo;
@override@JsonKey() final  bool esDefault;
@override@JsonKey() final  int orden;
@override final  String? cajaId;
@override final  String? mpExternalPosId;
@override final  String? mpTerminalId;
@override@JsonKey() final  String recargoTipo;
@override@JsonKey() final  int recargoVirtualBp;
@override@JsonKey() final  int recargoVirtualFijoCentavos;

/// Create a copy of PaymentMethod
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PaymentMethodCopyWith<_PaymentMethod> get copyWith => __$PaymentMethodCopyWithImpl<_PaymentMethod>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PaymentMethodToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PaymentMethod&&(identical(other.id, id) || other.id == id)&&(identical(other.nombre, nombre) || other.nombre == nombre)&&(identical(other.comisionBp, comisionBp) || other.comisionBp == comisionBp)&&(identical(other.esMercadoPago, esMercadoPago) || other.esMercadoPago == esMercadoPago)&&(identical(other.esEfectivo, esEfectivo) || other.esEfectivo == esEfectivo)&&(identical(other.activo, activo) || other.activo == activo)&&(identical(other.esDefault, esDefault) || other.esDefault == esDefault)&&(identical(other.orden, orden) || other.orden == orden)&&(identical(other.cajaId, cajaId) || other.cajaId == cajaId)&&(identical(other.mpExternalPosId, mpExternalPosId) || other.mpExternalPosId == mpExternalPosId)&&(identical(other.mpTerminalId, mpTerminalId) || other.mpTerminalId == mpTerminalId)&&(identical(other.recargoTipo, recargoTipo) || other.recargoTipo == recargoTipo)&&(identical(other.recargoVirtualBp, recargoVirtualBp) || other.recargoVirtualBp == recargoVirtualBp)&&(identical(other.recargoVirtualFijoCentavos, recargoVirtualFijoCentavos) || other.recargoVirtualFijoCentavos == recargoVirtualFijoCentavos));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,nombre,comisionBp,esMercadoPago,esEfectivo,activo,esDefault,orden,cajaId,mpExternalPosId,mpTerminalId,recargoTipo,recargoVirtualBp,recargoVirtualFijoCentavos);

@override
String toString() {
  return 'PaymentMethod(id: $id, nombre: $nombre, comisionBp: $comisionBp, esMercadoPago: $esMercadoPago, esEfectivo: $esEfectivo, activo: $activo, esDefault: $esDefault, orden: $orden, cajaId: $cajaId, mpExternalPosId: $mpExternalPosId, mpTerminalId: $mpTerminalId, recargoTipo: $recargoTipo, recargoVirtualBp: $recargoVirtualBp, recargoVirtualFijoCentavos: $recargoVirtualFijoCentavos)';
}


}

/// @nodoc
abstract mixin class _$PaymentMethodCopyWith<$Res> implements $PaymentMethodCopyWith<$Res> {
  factory _$PaymentMethodCopyWith(_PaymentMethod value, $Res Function(_PaymentMethod) _then) = __$PaymentMethodCopyWithImpl;
@override @useResult
$Res call({
 String id, String nombre, int comisionBp, bool esMercadoPago, bool esEfectivo, bool activo, bool esDefault, int orden, String? cajaId, String? mpExternalPosId, String? mpTerminalId, String recargoTipo, int recargoVirtualBp, int recargoVirtualFijoCentavos
});




}
/// @nodoc
class __$PaymentMethodCopyWithImpl<$Res>
    implements _$PaymentMethodCopyWith<$Res> {
  __$PaymentMethodCopyWithImpl(this._self, this._then);

  final _PaymentMethod _self;
  final $Res Function(_PaymentMethod) _then;

/// Create a copy of PaymentMethod
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? nombre = null,Object? comisionBp = null,Object? esMercadoPago = null,Object? esEfectivo = null,Object? activo = null,Object? esDefault = null,Object? orden = null,Object? cajaId = freezed,Object? mpExternalPosId = freezed,Object? mpTerminalId = freezed,Object? recargoTipo = null,Object? recargoVirtualBp = null,Object? recargoVirtualFijoCentavos = null,}) {
  return _then(_PaymentMethod(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,nombre: null == nombre ? _self.nombre : nombre // ignore: cast_nullable_to_non_nullable
as String,comisionBp: null == comisionBp ? _self.comisionBp : comisionBp // ignore: cast_nullable_to_non_nullable
as int,esMercadoPago: null == esMercadoPago ? _self.esMercadoPago : esMercadoPago // ignore: cast_nullable_to_non_nullable
as bool,esEfectivo: null == esEfectivo ? _self.esEfectivo : esEfectivo // ignore: cast_nullable_to_non_nullable
as bool,activo: null == activo ? _self.activo : activo // ignore: cast_nullable_to_non_nullable
as bool,esDefault: null == esDefault ? _self.esDefault : esDefault // ignore: cast_nullable_to_non_nullable
as bool,orden: null == orden ? _self.orden : orden // ignore: cast_nullable_to_non_nullable
as int,cajaId: freezed == cajaId ? _self.cajaId : cajaId // ignore: cast_nullable_to_non_nullable
as String?,mpExternalPosId: freezed == mpExternalPosId ? _self.mpExternalPosId : mpExternalPosId // ignore: cast_nullable_to_non_nullable
as String?,mpTerminalId: freezed == mpTerminalId ? _self.mpTerminalId : mpTerminalId // ignore: cast_nullable_to_non_nullable
as String?,recargoTipo: null == recargoTipo ? _self.recargoTipo : recargoTipo // ignore: cast_nullable_to_non_nullable
as String,recargoVirtualBp: null == recargoVirtualBp ? _self.recargoVirtualBp : recargoVirtualBp // ignore: cast_nullable_to_non_nullable
as int,recargoVirtualFijoCentavos: null == recargoVirtualFijoCentavos ? _self.recargoVirtualFijoCentavos : recargoVirtualFijoCentavos // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}

// dart format on
