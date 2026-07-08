// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'sale.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$SaleLine {

 String? get id; String get productId; int get cantidad; int? get gramos; int get precioUnitarioCentavos; int get costoUnitarioCentavos;
/// Create a copy of SaleLine
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SaleLineCopyWith<SaleLine> get copyWith => _$SaleLineCopyWithImpl<SaleLine>(this as SaleLine, _$identity);

  /// Serializes this SaleLine to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SaleLine&&(identical(other.id, id) || other.id == id)&&(identical(other.productId, productId) || other.productId == productId)&&(identical(other.cantidad, cantidad) || other.cantidad == cantidad)&&(identical(other.gramos, gramos) || other.gramos == gramos)&&(identical(other.precioUnitarioCentavos, precioUnitarioCentavos) || other.precioUnitarioCentavos == precioUnitarioCentavos)&&(identical(other.costoUnitarioCentavos, costoUnitarioCentavos) || other.costoUnitarioCentavos == costoUnitarioCentavos));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,productId,cantidad,gramos,precioUnitarioCentavos,costoUnitarioCentavos);

@override
String toString() {
  return 'SaleLine(id: $id, productId: $productId, cantidad: $cantidad, gramos: $gramos, precioUnitarioCentavos: $precioUnitarioCentavos, costoUnitarioCentavos: $costoUnitarioCentavos)';
}


}

/// @nodoc
abstract mixin class $SaleLineCopyWith<$Res>  {
  factory $SaleLineCopyWith(SaleLine value, $Res Function(SaleLine) _then) = _$SaleLineCopyWithImpl;
@useResult
$Res call({
 String? id, String productId, int cantidad, int? gramos, int precioUnitarioCentavos, int costoUnitarioCentavos
});




}
/// @nodoc
class _$SaleLineCopyWithImpl<$Res>
    implements $SaleLineCopyWith<$Res> {
  _$SaleLineCopyWithImpl(this._self, this._then);

  final SaleLine _self;
  final $Res Function(SaleLine) _then;

/// Create a copy of SaleLine
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = freezed,Object? productId = null,Object? cantidad = null,Object? gramos = freezed,Object? precioUnitarioCentavos = null,Object? costoUnitarioCentavos = null,}) {
  return _then(_self.copyWith(
id: freezed == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String?,productId: null == productId ? _self.productId : productId // ignore: cast_nullable_to_non_nullable
as String,cantidad: null == cantidad ? _self.cantidad : cantidad // ignore: cast_nullable_to_non_nullable
as int,gramos: freezed == gramos ? _self.gramos : gramos // ignore: cast_nullable_to_non_nullable
as int?,precioUnitarioCentavos: null == precioUnitarioCentavos ? _self.precioUnitarioCentavos : precioUnitarioCentavos // ignore: cast_nullable_to_non_nullable
as int,costoUnitarioCentavos: null == costoUnitarioCentavos ? _self.costoUnitarioCentavos : costoUnitarioCentavos // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [SaleLine].
extension SaleLinePatterns on SaleLine {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SaleLine value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SaleLine() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SaleLine value)  $default,){
final _that = this;
switch (_that) {
case _SaleLine():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SaleLine value)?  $default,){
final _that = this;
switch (_that) {
case _SaleLine() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String? id,  String productId,  int cantidad,  int? gramos,  int precioUnitarioCentavos,  int costoUnitarioCentavos)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SaleLine() when $default != null:
return $default(_that.id,_that.productId,_that.cantidad,_that.gramos,_that.precioUnitarioCentavos,_that.costoUnitarioCentavos);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String? id,  String productId,  int cantidad,  int? gramos,  int precioUnitarioCentavos,  int costoUnitarioCentavos)  $default,) {final _that = this;
switch (_that) {
case _SaleLine():
return $default(_that.id,_that.productId,_that.cantidad,_that.gramos,_that.precioUnitarioCentavos,_that.costoUnitarioCentavos);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String? id,  String productId,  int cantidad,  int? gramos,  int precioUnitarioCentavos,  int costoUnitarioCentavos)?  $default,) {final _that = this;
switch (_that) {
case _SaleLine() when $default != null:
return $default(_that.id,_that.productId,_that.cantidad,_that.gramos,_that.precioUnitarioCentavos,_that.costoUnitarioCentavos);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SaleLine implements SaleLine {
  const _SaleLine({this.id, required this.productId, required this.cantidad, this.gramos, required this.precioUnitarioCentavos, required this.costoUnitarioCentavos});
  factory _SaleLine.fromJson(Map<String, dynamic> json) => _$SaleLineFromJson(json);

@override final  String? id;
@override final  String productId;
@override final  int cantidad;
@override final  int? gramos;
@override final  int precioUnitarioCentavos;
@override final  int costoUnitarioCentavos;

/// Create a copy of SaleLine
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SaleLineCopyWith<_SaleLine> get copyWith => __$SaleLineCopyWithImpl<_SaleLine>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SaleLineToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SaleLine&&(identical(other.id, id) || other.id == id)&&(identical(other.productId, productId) || other.productId == productId)&&(identical(other.cantidad, cantidad) || other.cantidad == cantidad)&&(identical(other.gramos, gramos) || other.gramos == gramos)&&(identical(other.precioUnitarioCentavos, precioUnitarioCentavos) || other.precioUnitarioCentavos == precioUnitarioCentavos)&&(identical(other.costoUnitarioCentavos, costoUnitarioCentavos) || other.costoUnitarioCentavos == costoUnitarioCentavos));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,productId,cantidad,gramos,precioUnitarioCentavos,costoUnitarioCentavos);

@override
String toString() {
  return 'SaleLine(id: $id, productId: $productId, cantidad: $cantidad, gramos: $gramos, precioUnitarioCentavos: $precioUnitarioCentavos, costoUnitarioCentavos: $costoUnitarioCentavos)';
}


}

/// @nodoc
abstract mixin class _$SaleLineCopyWith<$Res> implements $SaleLineCopyWith<$Res> {
  factory _$SaleLineCopyWith(_SaleLine value, $Res Function(_SaleLine) _then) = __$SaleLineCopyWithImpl;
@override @useResult
$Res call({
 String? id, String productId, int cantidad, int? gramos, int precioUnitarioCentavos, int costoUnitarioCentavos
});




}
/// @nodoc
class __$SaleLineCopyWithImpl<$Res>
    implements _$SaleLineCopyWith<$Res> {
  __$SaleLineCopyWithImpl(this._self, this._then);

  final _SaleLine _self;
  final $Res Function(_SaleLine) _then;

/// Create a copy of SaleLine
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = freezed,Object? productId = null,Object? cantidad = null,Object? gramos = freezed,Object? precioUnitarioCentavos = null,Object? costoUnitarioCentavos = null,}) {
  return _then(_SaleLine(
id: freezed == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String?,productId: null == productId ? _self.productId : productId // ignore: cast_nullable_to_non_nullable
as String,cantidad: null == cantidad ? _self.cantidad : cantidad // ignore: cast_nullable_to_non_nullable
as int,gramos: freezed == gramos ? _self.gramos : gramos // ignore: cast_nullable_to_non_nullable
as int?,precioUnitarioCentavos: null == precioUnitarioCentavos ? _self.precioUnitarioCentavos : precioUnitarioCentavos // ignore: cast_nullable_to_non_nullable
as int,costoUnitarioCentavos: null == costoUnitarioCentavos ? _self.costoUnitarioCentavos : costoUnitarioCentavos // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$PaymentInput {

 String get paymentMethodId; int get montoCentavos;
/// Create a copy of PaymentInput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PaymentInputCopyWith<PaymentInput> get copyWith => _$PaymentInputCopyWithImpl<PaymentInput>(this as PaymentInput, _$identity);

  /// Serializes this PaymentInput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PaymentInput&&(identical(other.paymentMethodId, paymentMethodId) || other.paymentMethodId == paymentMethodId)&&(identical(other.montoCentavos, montoCentavos) || other.montoCentavos == montoCentavos));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,paymentMethodId,montoCentavos);

@override
String toString() {
  return 'PaymentInput(paymentMethodId: $paymentMethodId, montoCentavos: $montoCentavos)';
}


}

/// @nodoc
abstract mixin class $PaymentInputCopyWith<$Res>  {
  factory $PaymentInputCopyWith(PaymentInput value, $Res Function(PaymentInput) _then) = _$PaymentInputCopyWithImpl;
@useResult
$Res call({
 String paymentMethodId, int montoCentavos
});




}
/// @nodoc
class _$PaymentInputCopyWithImpl<$Res>
    implements $PaymentInputCopyWith<$Res> {
  _$PaymentInputCopyWithImpl(this._self, this._then);

  final PaymentInput _self;
  final $Res Function(PaymentInput) _then;

/// Create a copy of PaymentInput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? paymentMethodId = null,Object? montoCentavos = null,}) {
  return _then(_self.copyWith(
paymentMethodId: null == paymentMethodId ? _self.paymentMethodId : paymentMethodId // ignore: cast_nullable_to_non_nullable
as String,montoCentavos: null == montoCentavos ? _self.montoCentavos : montoCentavos // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [PaymentInput].
extension PaymentInputPatterns on PaymentInput {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PaymentInput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PaymentInput() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PaymentInput value)  $default,){
final _that = this;
switch (_that) {
case _PaymentInput():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PaymentInput value)?  $default,){
final _that = this;
switch (_that) {
case _PaymentInput() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String paymentMethodId,  int montoCentavos)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PaymentInput() when $default != null:
return $default(_that.paymentMethodId,_that.montoCentavos);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String paymentMethodId,  int montoCentavos)  $default,) {final _that = this;
switch (_that) {
case _PaymentInput():
return $default(_that.paymentMethodId,_that.montoCentavos);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String paymentMethodId,  int montoCentavos)?  $default,) {final _that = this;
switch (_that) {
case _PaymentInput() when $default != null:
return $default(_that.paymentMethodId,_that.montoCentavos);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PaymentInput implements PaymentInput {
  const _PaymentInput({required this.paymentMethodId, required this.montoCentavos});
  factory _PaymentInput.fromJson(Map<String, dynamic> json) => _$PaymentInputFromJson(json);

@override final  String paymentMethodId;
@override final  int montoCentavos;

/// Create a copy of PaymentInput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PaymentInputCopyWith<_PaymentInput> get copyWith => __$PaymentInputCopyWithImpl<_PaymentInput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PaymentInputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PaymentInput&&(identical(other.paymentMethodId, paymentMethodId) || other.paymentMethodId == paymentMethodId)&&(identical(other.montoCentavos, montoCentavos) || other.montoCentavos == montoCentavos));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,paymentMethodId,montoCentavos);

@override
String toString() {
  return 'PaymentInput(paymentMethodId: $paymentMethodId, montoCentavos: $montoCentavos)';
}


}

/// @nodoc
abstract mixin class _$PaymentInputCopyWith<$Res> implements $PaymentInputCopyWith<$Res> {
  factory _$PaymentInputCopyWith(_PaymentInput value, $Res Function(_PaymentInput) _then) = __$PaymentInputCopyWithImpl;
@override @useResult
$Res call({
 String paymentMethodId, int montoCentavos
});




}
/// @nodoc
class __$PaymentInputCopyWithImpl<$Res>
    implements _$PaymentInputCopyWith<$Res> {
  __$PaymentInputCopyWithImpl(this._self, this._then);

  final _PaymentInput _self;
  final $Res Function(_PaymentInput) _then;

/// Create a copy of PaymentInput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? paymentMethodId = null,Object? montoCentavos = null,}) {
  return _then(_PaymentInput(
paymentMethodId: null == paymentMethodId ? _self.paymentMethodId : paymentMethodId // ignore: cast_nullable_to_non_nullable
as String,montoCentavos: null == montoCentavos ? _self.montoCentavos : montoCentavos // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$Sale {

 String get id; DateTime get fecha; String get userId; int get totalCentavos; int get costoTotalCentavos; int get recargoCentavos; int get descuentoCentavos; List<SaleLine> get lines;
/// Create a copy of Sale
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SaleCopyWith<Sale> get copyWith => _$SaleCopyWithImpl<Sale>(this as Sale, _$identity);

  /// Serializes this Sale to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Sale&&(identical(other.id, id) || other.id == id)&&(identical(other.fecha, fecha) || other.fecha == fecha)&&(identical(other.userId, userId) || other.userId == userId)&&(identical(other.totalCentavos, totalCentavos) || other.totalCentavos == totalCentavos)&&(identical(other.costoTotalCentavos, costoTotalCentavos) || other.costoTotalCentavos == costoTotalCentavos)&&(identical(other.recargoCentavos, recargoCentavos) || other.recargoCentavos == recargoCentavos)&&(identical(other.descuentoCentavos, descuentoCentavos) || other.descuentoCentavos == descuentoCentavos)&&const DeepCollectionEquality().equals(other.lines, lines));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,fecha,userId,totalCentavos,costoTotalCentavos,recargoCentavos,descuentoCentavos,const DeepCollectionEquality().hash(lines));

@override
String toString() {
  return 'Sale(id: $id, fecha: $fecha, userId: $userId, totalCentavos: $totalCentavos, costoTotalCentavos: $costoTotalCentavos, recargoCentavos: $recargoCentavos, descuentoCentavos: $descuentoCentavos, lines: $lines)';
}


}

/// @nodoc
abstract mixin class $SaleCopyWith<$Res>  {
  factory $SaleCopyWith(Sale value, $Res Function(Sale) _then) = _$SaleCopyWithImpl;
@useResult
$Res call({
 String id, DateTime fecha, String userId, int totalCentavos, int costoTotalCentavos, int recargoCentavos, int descuentoCentavos, List<SaleLine> lines
});




}
/// @nodoc
class _$SaleCopyWithImpl<$Res>
    implements $SaleCopyWith<$Res> {
  _$SaleCopyWithImpl(this._self, this._then);

  final Sale _self;
  final $Res Function(Sale) _then;

/// Create a copy of Sale
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? fecha = null,Object? userId = null,Object? totalCentavos = null,Object? costoTotalCentavos = null,Object? recargoCentavos = null,Object? descuentoCentavos = null,Object? lines = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,fecha: null == fecha ? _self.fecha : fecha // ignore: cast_nullable_to_non_nullable
as DateTime,userId: null == userId ? _self.userId : userId // ignore: cast_nullable_to_non_nullable
as String,totalCentavos: null == totalCentavos ? _self.totalCentavos : totalCentavos // ignore: cast_nullable_to_non_nullable
as int,costoTotalCentavos: null == costoTotalCentavos ? _self.costoTotalCentavos : costoTotalCentavos // ignore: cast_nullable_to_non_nullable
as int,recargoCentavos: null == recargoCentavos ? _self.recargoCentavos : recargoCentavos // ignore: cast_nullable_to_non_nullable
as int,descuentoCentavos: null == descuentoCentavos ? _self.descuentoCentavos : descuentoCentavos // ignore: cast_nullable_to_non_nullable
as int,lines: null == lines ? _self.lines : lines // ignore: cast_nullable_to_non_nullable
as List<SaleLine>,
  ));
}

}


/// Adds pattern-matching-related methods to [Sale].
extension SalePatterns on Sale {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Sale value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Sale() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Sale value)  $default,){
final _that = this;
switch (_that) {
case _Sale():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Sale value)?  $default,){
final _that = this;
switch (_that) {
case _Sale() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  DateTime fecha,  String userId,  int totalCentavos,  int costoTotalCentavos,  int recargoCentavos,  int descuentoCentavos,  List<SaleLine> lines)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Sale() when $default != null:
return $default(_that.id,_that.fecha,_that.userId,_that.totalCentavos,_that.costoTotalCentavos,_that.recargoCentavos,_that.descuentoCentavos,_that.lines);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  DateTime fecha,  String userId,  int totalCentavos,  int costoTotalCentavos,  int recargoCentavos,  int descuentoCentavos,  List<SaleLine> lines)  $default,) {final _that = this;
switch (_that) {
case _Sale():
return $default(_that.id,_that.fecha,_that.userId,_that.totalCentavos,_that.costoTotalCentavos,_that.recargoCentavos,_that.descuentoCentavos,_that.lines);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  DateTime fecha,  String userId,  int totalCentavos,  int costoTotalCentavos,  int recargoCentavos,  int descuentoCentavos,  List<SaleLine> lines)?  $default,) {final _that = this;
switch (_that) {
case _Sale() when $default != null:
return $default(_that.id,_that.fecha,_that.userId,_that.totalCentavos,_that.costoTotalCentavos,_that.recargoCentavos,_that.descuentoCentavos,_that.lines);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Sale implements Sale {
  const _Sale({required this.id, required this.fecha, required this.userId, required this.totalCentavos, required this.costoTotalCentavos, this.recargoCentavos = 0, this.descuentoCentavos = 0, final  List<SaleLine> lines = const []}): _lines = lines;
  factory _Sale.fromJson(Map<String, dynamic> json) => _$SaleFromJson(json);

@override final  String id;
@override final  DateTime fecha;
@override final  String userId;
@override final  int totalCentavos;
@override final  int costoTotalCentavos;
@override@JsonKey() final  int recargoCentavos;
@override@JsonKey() final  int descuentoCentavos;
 final  List<SaleLine> _lines;
@override@JsonKey() List<SaleLine> get lines {
  if (_lines is EqualUnmodifiableListView) return _lines;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_lines);
}


/// Create a copy of Sale
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SaleCopyWith<_Sale> get copyWith => __$SaleCopyWithImpl<_Sale>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SaleToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Sale&&(identical(other.id, id) || other.id == id)&&(identical(other.fecha, fecha) || other.fecha == fecha)&&(identical(other.userId, userId) || other.userId == userId)&&(identical(other.totalCentavos, totalCentavos) || other.totalCentavos == totalCentavos)&&(identical(other.costoTotalCentavos, costoTotalCentavos) || other.costoTotalCentavos == costoTotalCentavos)&&(identical(other.recargoCentavos, recargoCentavos) || other.recargoCentavos == recargoCentavos)&&(identical(other.descuentoCentavos, descuentoCentavos) || other.descuentoCentavos == descuentoCentavos)&&const DeepCollectionEquality().equals(other._lines, _lines));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,fecha,userId,totalCentavos,costoTotalCentavos,recargoCentavos,descuentoCentavos,const DeepCollectionEquality().hash(_lines));

@override
String toString() {
  return 'Sale(id: $id, fecha: $fecha, userId: $userId, totalCentavos: $totalCentavos, costoTotalCentavos: $costoTotalCentavos, recargoCentavos: $recargoCentavos, descuentoCentavos: $descuentoCentavos, lines: $lines)';
}


}

/// @nodoc
abstract mixin class _$SaleCopyWith<$Res> implements $SaleCopyWith<$Res> {
  factory _$SaleCopyWith(_Sale value, $Res Function(_Sale) _then) = __$SaleCopyWithImpl;
@override @useResult
$Res call({
 String id, DateTime fecha, String userId, int totalCentavos, int costoTotalCentavos, int recargoCentavos, int descuentoCentavos, List<SaleLine> lines
});




}
/// @nodoc
class __$SaleCopyWithImpl<$Res>
    implements _$SaleCopyWith<$Res> {
  __$SaleCopyWithImpl(this._self, this._then);

  final _Sale _self;
  final $Res Function(_Sale) _then;

/// Create a copy of Sale
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? fecha = null,Object? userId = null,Object? totalCentavos = null,Object? costoTotalCentavos = null,Object? recargoCentavos = null,Object? descuentoCentavos = null,Object? lines = null,}) {
  return _then(_Sale(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,fecha: null == fecha ? _self.fecha : fecha // ignore: cast_nullable_to_non_nullable
as DateTime,userId: null == userId ? _self.userId : userId // ignore: cast_nullable_to_non_nullable
as String,totalCentavos: null == totalCentavos ? _self.totalCentavos : totalCentavos // ignore: cast_nullable_to_non_nullable
as int,costoTotalCentavos: null == costoTotalCentavos ? _self.costoTotalCentavos : costoTotalCentavos // ignore: cast_nullable_to_non_nullable
as int,recargoCentavos: null == recargoCentavos ? _self.recargoCentavos : recargoCentavos // ignore: cast_nullable_to_non_nullable
as int,descuentoCentavos: null == descuentoCentavos ? _self.descuentoCentavos : descuentoCentavos // ignore: cast_nullable_to_non_nullable
as int,lines: null == lines ? _self._lines : lines // ignore: cast_nullable_to_non_nullable
as List<SaleLine>,
  ));
}


}

// dart format on
