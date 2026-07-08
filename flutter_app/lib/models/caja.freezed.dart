// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'caja.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$Caja {

 String get id; String get nombre; bool get esPrincipal; int get orden; bool get activo; int? get saldoManualCentavos;
/// Create a copy of Caja
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CajaCopyWith<Caja> get copyWith => _$CajaCopyWithImpl<Caja>(this as Caja, _$identity);

  /// Serializes this Caja to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Caja&&(identical(other.id, id) || other.id == id)&&(identical(other.nombre, nombre) || other.nombre == nombre)&&(identical(other.esPrincipal, esPrincipal) || other.esPrincipal == esPrincipal)&&(identical(other.orden, orden) || other.orden == orden)&&(identical(other.activo, activo) || other.activo == activo)&&(identical(other.saldoManualCentavos, saldoManualCentavos) || other.saldoManualCentavos == saldoManualCentavos));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,nombre,esPrincipal,orden,activo,saldoManualCentavos);

@override
String toString() {
  return 'Caja(id: $id, nombre: $nombre, esPrincipal: $esPrincipal, orden: $orden, activo: $activo, saldoManualCentavos: $saldoManualCentavos)';
}


}

/// @nodoc
abstract mixin class $CajaCopyWith<$Res>  {
  factory $CajaCopyWith(Caja value, $Res Function(Caja) _then) = _$CajaCopyWithImpl;
@useResult
$Res call({
 String id, String nombre, bool esPrincipal, int orden, bool activo, int? saldoManualCentavos
});




}
/// @nodoc
class _$CajaCopyWithImpl<$Res>
    implements $CajaCopyWith<$Res> {
  _$CajaCopyWithImpl(this._self, this._then);

  final Caja _self;
  final $Res Function(Caja) _then;

/// Create a copy of Caja
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? nombre = null,Object? esPrincipal = null,Object? orden = null,Object? activo = null,Object? saldoManualCentavos = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,nombre: null == nombre ? _self.nombre : nombre // ignore: cast_nullable_to_non_nullable
as String,esPrincipal: null == esPrincipal ? _self.esPrincipal : esPrincipal // ignore: cast_nullable_to_non_nullable
as bool,orden: null == orden ? _self.orden : orden // ignore: cast_nullable_to_non_nullable
as int,activo: null == activo ? _self.activo : activo // ignore: cast_nullable_to_non_nullable
as bool,saldoManualCentavos: freezed == saldoManualCentavos ? _self.saldoManualCentavos : saldoManualCentavos // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

}


/// Adds pattern-matching-related methods to [Caja].
extension CajaPatterns on Caja {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Caja value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Caja() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Caja value)  $default,){
final _that = this;
switch (_that) {
case _Caja():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Caja value)?  $default,){
final _that = this;
switch (_that) {
case _Caja() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String nombre,  bool esPrincipal,  int orden,  bool activo,  int? saldoManualCentavos)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Caja() when $default != null:
return $default(_that.id,_that.nombre,_that.esPrincipal,_that.orden,_that.activo,_that.saldoManualCentavos);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String nombre,  bool esPrincipal,  int orden,  bool activo,  int? saldoManualCentavos)  $default,) {final _that = this;
switch (_that) {
case _Caja():
return $default(_that.id,_that.nombre,_that.esPrincipal,_that.orden,_that.activo,_that.saldoManualCentavos);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String nombre,  bool esPrincipal,  int orden,  bool activo,  int? saldoManualCentavos)?  $default,) {final _that = this;
switch (_that) {
case _Caja() when $default != null:
return $default(_that.id,_that.nombre,_that.esPrincipal,_that.orden,_that.activo,_that.saldoManualCentavos);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Caja implements Caja {
  const _Caja({required this.id, required this.nombre, this.esPrincipal = false, this.orden = 0, this.activo = true, this.saldoManualCentavos});
  factory _Caja.fromJson(Map<String, dynamic> json) => _$CajaFromJson(json);

@override final  String id;
@override final  String nombre;
@override@JsonKey() final  bool esPrincipal;
@override@JsonKey() final  int orden;
@override@JsonKey() final  bool activo;
@override final  int? saldoManualCentavos;

/// Create a copy of Caja
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CajaCopyWith<_Caja> get copyWith => __$CajaCopyWithImpl<_Caja>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CajaToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Caja&&(identical(other.id, id) || other.id == id)&&(identical(other.nombre, nombre) || other.nombre == nombre)&&(identical(other.esPrincipal, esPrincipal) || other.esPrincipal == esPrincipal)&&(identical(other.orden, orden) || other.orden == orden)&&(identical(other.activo, activo) || other.activo == activo)&&(identical(other.saldoManualCentavos, saldoManualCentavos) || other.saldoManualCentavos == saldoManualCentavos));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,nombre,esPrincipal,orden,activo,saldoManualCentavos);

@override
String toString() {
  return 'Caja(id: $id, nombre: $nombre, esPrincipal: $esPrincipal, orden: $orden, activo: $activo, saldoManualCentavos: $saldoManualCentavos)';
}


}

/// @nodoc
abstract mixin class _$CajaCopyWith<$Res> implements $CajaCopyWith<$Res> {
  factory _$CajaCopyWith(_Caja value, $Res Function(_Caja) _then) = __$CajaCopyWithImpl;
@override @useResult
$Res call({
 String id, String nombre, bool esPrincipal, int orden, bool activo, int? saldoManualCentavos
});




}
/// @nodoc
class __$CajaCopyWithImpl<$Res>
    implements _$CajaCopyWith<$Res> {
  __$CajaCopyWithImpl(this._self, this._then);

  final _Caja _self;
  final $Res Function(_Caja) _then;

/// Create a copy of Caja
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? nombre = null,Object? esPrincipal = null,Object? orden = null,Object? activo = null,Object? saldoManualCentavos = freezed,}) {
  return _then(_Caja(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,nombre: null == nombre ? _self.nombre : nombre // ignore: cast_nullable_to_non_nullable
as String,esPrincipal: null == esPrincipal ? _self.esPrincipal : esPrincipal // ignore: cast_nullable_to_non_nullable
as bool,orden: null == orden ? _self.orden : orden // ignore: cast_nullable_to_non_nullable
as int,activo: null == activo ? _self.activo : activo // ignore: cast_nullable_to_non_nullable
as bool,saldoManualCentavos: freezed == saldoManualCentavos ? _self.saldoManualCentavos : saldoManualCentavos // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}


}


/// @nodoc
mixin _$CajaSesion {

 String get id; String get cajaId; String get abiertaPorUserId; String? get cerradaPorUserId; int get fondoInicialCentavos; DateTime get fechaApertura; DateTime? get fechaCierre; int? get efectivoEsperadoCentavos; int? get efectivoContadoCentavos; int? get diferenciaCentavos; String? get nota; String get estado;
/// Create a copy of CajaSesion
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CajaSesionCopyWith<CajaSesion> get copyWith => _$CajaSesionCopyWithImpl<CajaSesion>(this as CajaSesion, _$identity);

  /// Serializes this CajaSesion to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CajaSesion&&(identical(other.id, id) || other.id == id)&&(identical(other.cajaId, cajaId) || other.cajaId == cajaId)&&(identical(other.abiertaPorUserId, abiertaPorUserId) || other.abiertaPorUserId == abiertaPorUserId)&&(identical(other.cerradaPorUserId, cerradaPorUserId) || other.cerradaPorUserId == cerradaPorUserId)&&(identical(other.fondoInicialCentavos, fondoInicialCentavos) || other.fondoInicialCentavos == fondoInicialCentavos)&&(identical(other.fechaApertura, fechaApertura) || other.fechaApertura == fechaApertura)&&(identical(other.fechaCierre, fechaCierre) || other.fechaCierre == fechaCierre)&&(identical(other.efectivoEsperadoCentavos, efectivoEsperadoCentavos) || other.efectivoEsperadoCentavos == efectivoEsperadoCentavos)&&(identical(other.efectivoContadoCentavos, efectivoContadoCentavos) || other.efectivoContadoCentavos == efectivoContadoCentavos)&&(identical(other.diferenciaCentavos, diferenciaCentavos) || other.diferenciaCentavos == diferenciaCentavos)&&(identical(other.nota, nota) || other.nota == nota)&&(identical(other.estado, estado) || other.estado == estado));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,cajaId,abiertaPorUserId,cerradaPorUserId,fondoInicialCentavos,fechaApertura,fechaCierre,efectivoEsperadoCentavos,efectivoContadoCentavos,diferenciaCentavos,nota,estado);

@override
String toString() {
  return 'CajaSesion(id: $id, cajaId: $cajaId, abiertaPorUserId: $abiertaPorUserId, cerradaPorUserId: $cerradaPorUserId, fondoInicialCentavos: $fondoInicialCentavos, fechaApertura: $fechaApertura, fechaCierre: $fechaCierre, efectivoEsperadoCentavos: $efectivoEsperadoCentavos, efectivoContadoCentavos: $efectivoContadoCentavos, diferenciaCentavos: $diferenciaCentavos, nota: $nota, estado: $estado)';
}


}

/// @nodoc
abstract mixin class $CajaSesionCopyWith<$Res>  {
  factory $CajaSesionCopyWith(CajaSesion value, $Res Function(CajaSesion) _then) = _$CajaSesionCopyWithImpl;
@useResult
$Res call({
 String id, String cajaId, String abiertaPorUserId, String? cerradaPorUserId, int fondoInicialCentavos, DateTime fechaApertura, DateTime? fechaCierre, int? efectivoEsperadoCentavos, int? efectivoContadoCentavos, int? diferenciaCentavos, String? nota, String estado
});




}
/// @nodoc
class _$CajaSesionCopyWithImpl<$Res>
    implements $CajaSesionCopyWith<$Res> {
  _$CajaSesionCopyWithImpl(this._self, this._then);

  final CajaSesion _self;
  final $Res Function(CajaSesion) _then;

/// Create a copy of CajaSesion
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? cajaId = null,Object? abiertaPorUserId = null,Object? cerradaPorUserId = freezed,Object? fondoInicialCentavos = null,Object? fechaApertura = null,Object? fechaCierre = freezed,Object? efectivoEsperadoCentavos = freezed,Object? efectivoContadoCentavos = freezed,Object? diferenciaCentavos = freezed,Object? nota = freezed,Object? estado = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,cajaId: null == cajaId ? _self.cajaId : cajaId // ignore: cast_nullable_to_non_nullable
as String,abiertaPorUserId: null == abiertaPorUserId ? _self.abiertaPorUserId : abiertaPorUserId // ignore: cast_nullable_to_non_nullable
as String,cerradaPorUserId: freezed == cerradaPorUserId ? _self.cerradaPorUserId : cerradaPorUserId // ignore: cast_nullable_to_non_nullable
as String?,fondoInicialCentavos: null == fondoInicialCentavos ? _self.fondoInicialCentavos : fondoInicialCentavos // ignore: cast_nullable_to_non_nullable
as int,fechaApertura: null == fechaApertura ? _self.fechaApertura : fechaApertura // ignore: cast_nullable_to_non_nullable
as DateTime,fechaCierre: freezed == fechaCierre ? _self.fechaCierre : fechaCierre // ignore: cast_nullable_to_non_nullable
as DateTime?,efectivoEsperadoCentavos: freezed == efectivoEsperadoCentavos ? _self.efectivoEsperadoCentavos : efectivoEsperadoCentavos // ignore: cast_nullable_to_non_nullable
as int?,efectivoContadoCentavos: freezed == efectivoContadoCentavos ? _self.efectivoContadoCentavos : efectivoContadoCentavos // ignore: cast_nullable_to_non_nullable
as int?,diferenciaCentavos: freezed == diferenciaCentavos ? _self.diferenciaCentavos : diferenciaCentavos // ignore: cast_nullable_to_non_nullable
as int?,nota: freezed == nota ? _self.nota : nota // ignore: cast_nullable_to_non_nullable
as String?,estado: null == estado ? _self.estado : estado // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [CajaSesion].
extension CajaSesionPatterns on CajaSesion {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CajaSesion value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CajaSesion() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CajaSesion value)  $default,){
final _that = this;
switch (_that) {
case _CajaSesion():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CajaSesion value)?  $default,){
final _that = this;
switch (_that) {
case _CajaSesion() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String cajaId,  String abiertaPorUserId,  String? cerradaPorUserId,  int fondoInicialCentavos,  DateTime fechaApertura,  DateTime? fechaCierre,  int? efectivoEsperadoCentavos,  int? efectivoContadoCentavos,  int? diferenciaCentavos,  String? nota,  String estado)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CajaSesion() when $default != null:
return $default(_that.id,_that.cajaId,_that.abiertaPorUserId,_that.cerradaPorUserId,_that.fondoInicialCentavos,_that.fechaApertura,_that.fechaCierre,_that.efectivoEsperadoCentavos,_that.efectivoContadoCentavos,_that.diferenciaCentavos,_that.nota,_that.estado);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String cajaId,  String abiertaPorUserId,  String? cerradaPorUserId,  int fondoInicialCentavos,  DateTime fechaApertura,  DateTime? fechaCierre,  int? efectivoEsperadoCentavos,  int? efectivoContadoCentavos,  int? diferenciaCentavos,  String? nota,  String estado)  $default,) {final _that = this;
switch (_that) {
case _CajaSesion():
return $default(_that.id,_that.cajaId,_that.abiertaPorUserId,_that.cerradaPorUserId,_that.fondoInicialCentavos,_that.fechaApertura,_that.fechaCierre,_that.efectivoEsperadoCentavos,_that.efectivoContadoCentavos,_that.diferenciaCentavos,_that.nota,_that.estado);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String cajaId,  String abiertaPorUserId,  String? cerradaPorUserId,  int fondoInicialCentavos,  DateTime fechaApertura,  DateTime? fechaCierre,  int? efectivoEsperadoCentavos,  int? efectivoContadoCentavos,  int? diferenciaCentavos,  String? nota,  String estado)?  $default,) {final _that = this;
switch (_that) {
case _CajaSesion() when $default != null:
return $default(_that.id,_that.cajaId,_that.abiertaPorUserId,_that.cerradaPorUserId,_that.fondoInicialCentavos,_that.fechaApertura,_that.fechaCierre,_that.efectivoEsperadoCentavos,_that.efectivoContadoCentavos,_that.diferenciaCentavos,_that.nota,_that.estado);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CajaSesion implements CajaSesion {
  const _CajaSesion({required this.id, required this.cajaId, required this.abiertaPorUserId, this.cerradaPorUserId, required this.fondoInicialCentavos, required this.fechaApertura, this.fechaCierre, this.efectivoEsperadoCentavos, this.efectivoContadoCentavos, this.diferenciaCentavos, this.nota, required this.estado});
  factory _CajaSesion.fromJson(Map<String, dynamic> json) => _$CajaSesionFromJson(json);

@override final  String id;
@override final  String cajaId;
@override final  String abiertaPorUserId;
@override final  String? cerradaPorUserId;
@override final  int fondoInicialCentavos;
@override final  DateTime fechaApertura;
@override final  DateTime? fechaCierre;
@override final  int? efectivoEsperadoCentavos;
@override final  int? efectivoContadoCentavos;
@override final  int? diferenciaCentavos;
@override final  String? nota;
@override final  String estado;

/// Create a copy of CajaSesion
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CajaSesionCopyWith<_CajaSesion> get copyWith => __$CajaSesionCopyWithImpl<_CajaSesion>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CajaSesionToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CajaSesion&&(identical(other.id, id) || other.id == id)&&(identical(other.cajaId, cajaId) || other.cajaId == cajaId)&&(identical(other.abiertaPorUserId, abiertaPorUserId) || other.abiertaPorUserId == abiertaPorUserId)&&(identical(other.cerradaPorUserId, cerradaPorUserId) || other.cerradaPorUserId == cerradaPorUserId)&&(identical(other.fondoInicialCentavos, fondoInicialCentavos) || other.fondoInicialCentavos == fondoInicialCentavos)&&(identical(other.fechaApertura, fechaApertura) || other.fechaApertura == fechaApertura)&&(identical(other.fechaCierre, fechaCierre) || other.fechaCierre == fechaCierre)&&(identical(other.efectivoEsperadoCentavos, efectivoEsperadoCentavos) || other.efectivoEsperadoCentavos == efectivoEsperadoCentavos)&&(identical(other.efectivoContadoCentavos, efectivoContadoCentavos) || other.efectivoContadoCentavos == efectivoContadoCentavos)&&(identical(other.diferenciaCentavos, diferenciaCentavos) || other.diferenciaCentavos == diferenciaCentavos)&&(identical(other.nota, nota) || other.nota == nota)&&(identical(other.estado, estado) || other.estado == estado));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,cajaId,abiertaPorUserId,cerradaPorUserId,fondoInicialCentavos,fechaApertura,fechaCierre,efectivoEsperadoCentavos,efectivoContadoCentavos,diferenciaCentavos,nota,estado);

@override
String toString() {
  return 'CajaSesion(id: $id, cajaId: $cajaId, abiertaPorUserId: $abiertaPorUserId, cerradaPorUserId: $cerradaPorUserId, fondoInicialCentavos: $fondoInicialCentavos, fechaApertura: $fechaApertura, fechaCierre: $fechaCierre, efectivoEsperadoCentavos: $efectivoEsperadoCentavos, efectivoContadoCentavos: $efectivoContadoCentavos, diferenciaCentavos: $diferenciaCentavos, nota: $nota, estado: $estado)';
}


}

/// @nodoc
abstract mixin class _$CajaSesionCopyWith<$Res> implements $CajaSesionCopyWith<$Res> {
  factory _$CajaSesionCopyWith(_CajaSesion value, $Res Function(_CajaSesion) _then) = __$CajaSesionCopyWithImpl;
@override @useResult
$Res call({
 String id, String cajaId, String abiertaPorUserId, String? cerradaPorUserId, int fondoInicialCentavos, DateTime fechaApertura, DateTime? fechaCierre, int? efectivoEsperadoCentavos, int? efectivoContadoCentavos, int? diferenciaCentavos, String? nota, String estado
});




}
/// @nodoc
class __$CajaSesionCopyWithImpl<$Res>
    implements _$CajaSesionCopyWith<$Res> {
  __$CajaSesionCopyWithImpl(this._self, this._then);

  final _CajaSesion _self;
  final $Res Function(_CajaSesion) _then;

/// Create a copy of CajaSesion
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? cajaId = null,Object? abiertaPorUserId = null,Object? cerradaPorUserId = freezed,Object? fondoInicialCentavos = null,Object? fechaApertura = null,Object? fechaCierre = freezed,Object? efectivoEsperadoCentavos = freezed,Object? efectivoContadoCentavos = freezed,Object? diferenciaCentavos = freezed,Object? nota = freezed,Object? estado = null,}) {
  return _then(_CajaSesion(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,cajaId: null == cajaId ? _self.cajaId : cajaId // ignore: cast_nullable_to_non_nullable
as String,abiertaPorUserId: null == abiertaPorUserId ? _self.abiertaPorUserId : abiertaPorUserId // ignore: cast_nullable_to_non_nullable
as String,cerradaPorUserId: freezed == cerradaPorUserId ? _self.cerradaPorUserId : cerradaPorUserId // ignore: cast_nullable_to_non_nullable
as String?,fondoInicialCentavos: null == fondoInicialCentavos ? _self.fondoInicialCentavos : fondoInicialCentavos // ignore: cast_nullable_to_non_nullable
as int,fechaApertura: null == fechaApertura ? _self.fechaApertura : fechaApertura // ignore: cast_nullable_to_non_nullable
as DateTime,fechaCierre: freezed == fechaCierre ? _self.fechaCierre : fechaCierre // ignore: cast_nullable_to_non_nullable
as DateTime?,efectivoEsperadoCentavos: freezed == efectivoEsperadoCentavos ? _self.efectivoEsperadoCentavos : efectivoEsperadoCentavos // ignore: cast_nullable_to_non_nullable
as int?,efectivoContadoCentavos: freezed == efectivoContadoCentavos ? _self.efectivoContadoCentavos : efectivoContadoCentavos // ignore: cast_nullable_to_non_nullable
as int?,diferenciaCentavos: freezed == diferenciaCentavos ? _self.diferenciaCentavos : diferenciaCentavos // ignore: cast_nullable_to_non_nullable
as int?,nota: freezed == nota ? _self.nota : nota // ignore: cast_nullable_to_non_nullable
as String?,estado: null == estado ? _self.estado : estado // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
