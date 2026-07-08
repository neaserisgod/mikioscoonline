// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'product.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$Product {

 String get id; String get sku; String? get barcode; String get nombre; int get costoCentavos; int get precioCentavos; bool get costoEsProvisional; String get categoryId; String? get providerId; String? get locationId; int get stock; int get stockMinimo; bool get esPesable; int? get costoPorKgCentavos; int? get precioPorKgCentavos; int? get stockGramos; int? get stockMinimoGramos; bool get activo;
/// Create a copy of Product
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ProductCopyWith<Product> get copyWith => _$ProductCopyWithImpl<Product>(this as Product, _$identity);

  /// Serializes this Product to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Product&&(identical(other.id, id) || other.id == id)&&(identical(other.sku, sku) || other.sku == sku)&&(identical(other.barcode, barcode) || other.barcode == barcode)&&(identical(other.nombre, nombre) || other.nombre == nombre)&&(identical(other.costoCentavos, costoCentavos) || other.costoCentavos == costoCentavos)&&(identical(other.precioCentavos, precioCentavos) || other.precioCentavos == precioCentavos)&&(identical(other.costoEsProvisional, costoEsProvisional) || other.costoEsProvisional == costoEsProvisional)&&(identical(other.categoryId, categoryId) || other.categoryId == categoryId)&&(identical(other.providerId, providerId) || other.providerId == providerId)&&(identical(other.locationId, locationId) || other.locationId == locationId)&&(identical(other.stock, stock) || other.stock == stock)&&(identical(other.stockMinimo, stockMinimo) || other.stockMinimo == stockMinimo)&&(identical(other.esPesable, esPesable) || other.esPesable == esPesable)&&(identical(other.costoPorKgCentavos, costoPorKgCentavos) || other.costoPorKgCentavos == costoPorKgCentavos)&&(identical(other.precioPorKgCentavos, precioPorKgCentavos) || other.precioPorKgCentavos == precioPorKgCentavos)&&(identical(other.stockGramos, stockGramos) || other.stockGramos == stockGramos)&&(identical(other.stockMinimoGramos, stockMinimoGramos) || other.stockMinimoGramos == stockMinimoGramos)&&(identical(other.activo, activo) || other.activo == activo));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,sku,barcode,nombre,costoCentavos,precioCentavos,costoEsProvisional,categoryId,providerId,locationId,stock,stockMinimo,esPesable,costoPorKgCentavos,precioPorKgCentavos,stockGramos,stockMinimoGramos,activo);

@override
String toString() {
  return 'Product(id: $id, sku: $sku, barcode: $barcode, nombre: $nombre, costoCentavos: $costoCentavos, precioCentavos: $precioCentavos, costoEsProvisional: $costoEsProvisional, categoryId: $categoryId, providerId: $providerId, locationId: $locationId, stock: $stock, stockMinimo: $stockMinimo, esPesable: $esPesable, costoPorKgCentavos: $costoPorKgCentavos, precioPorKgCentavos: $precioPorKgCentavos, stockGramos: $stockGramos, stockMinimoGramos: $stockMinimoGramos, activo: $activo)';
}


}

/// @nodoc
abstract mixin class $ProductCopyWith<$Res>  {
  factory $ProductCopyWith(Product value, $Res Function(Product) _then) = _$ProductCopyWithImpl;
@useResult
$Res call({
 String id, String sku, String? barcode, String nombre, int costoCentavos, int precioCentavos, bool costoEsProvisional, String categoryId, String? providerId, String? locationId, int stock, int stockMinimo, bool esPesable, int? costoPorKgCentavos, int? precioPorKgCentavos, int? stockGramos, int? stockMinimoGramos, bool activo
});




}
/// @nodoc
class _$ProductCopyWithImpl<$Res>
    implements $ProductCopyWith<$Res> {
  _$ProductCopyWithImpl(this._self, this._then);

  final Product _self;
  final $Res Function(Product) _then;

/// Create a copy of Product
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? sku = null,Object? barcode = freezed,Object? nombre = null,Object? costoCentavos = null,Object? precioCentavos = null,Object? costoEsProvisional = null,Object? categoryId = null,Object? providerId = freezed,Object? locationId = freezed,Object? stock = null,Object? stockMinimo = null,Object? esPesable = null,Object? costoPorKgCentavos = freezed,Object? precioPorKgCentavos = freezed,Object? stockGramos = freezed,Object? stockMinimoGramos = freezed,Object? activo = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,sku: null == sku ? _self.sku : sku // ignore: cast_nullable_to_non_nullable
as String,barcode: freezed == barcode ? _self.barcode : barcode // ignore: cast_nullable_to_non_nullable
as String?,nombre: null == nombre ? _self.nombre : nombre // ignore: cast_nullable_to_non_nullable
as String,costoCentavos: null == costoCentavos ? _self.costoCentavos : costoCentavos // ignore: cast_nullable_to_non_nullable
as int,precioCentavos: null == precioCentavos ? _self.precioCentavos : precioCentavos // ignore: cast_nullable_to_non_nullable
as int,costoEsProvisional: null == costoEsProvisional ? _self.costoEsProvisional : costoEsProvisional // ignore: cast_nullable_to_non_nullable
as bool,categoryId: null == categoryId ? _self.categoryId : categoryId // ignore: cast_nullable_to_non_nullable
as String,providerId: freezed == providerId ? _self.providerId : providerId // ignore: cast_nullable_to_non_nullable
as String?,locationId: freezed == locationId ? _self.locationId : locationId // ignore: cast_nullable_to_non_nullable
as String?,stock: null == stock ? _self.stock : stock // ignore: cast_nullable_to_non_nullable
as int,stockMinimo: null == stockMinimo ? _self.stockMinimo : stockMinimo // ignore: cast_nullable_to_non_nullable
as int,esPesable: null == esPesable ? _self.esPesable : esPesable // ignore: cast_nullable_to_non_nullable
as bool,costoPorKgCentavos: freezed == costoPorKgCentavos ? _self.costoPorKgCentavos : costoPorKgCentavos // ignore: cast_nullable_to_non_nullable
as int?,precioPorKgCentavos: freezed == precioPorKgCentavos ? _self.precioPorKgCentavos : precioPorKgCentavos // ignore: cast_nullable_to_non_nullable
as int?,stockGramos: freezed == stockGramos ? _self.stockGramos : stockGramos // ignore: cast_nullable_to_non_nullable
as int?,stockMinimoGramos: freezed == stockMinimoGramos ? _self.stockMinimoGramos : stockMinimoGramos // ignore: cast_nullable_to_non_nullable
as int?,activo: null == activo ? _self.activo : activo // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [Product].
extension ProductPatterns on Product {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Product value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Product() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Product value)  $default,){
final _that = this;
switch (_that) {
case _Product():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Product value)?  $default,){
final _that = this;
switch (_that) {
case _Product() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String sku,  String? barcode,  String nombre,  int costoCentavos,  int precioCentavos,  bool costoEsProvisional,  String categoryId,  String? providerId,  String? locationId,  int stock,  int stockMinimo,  bool esPesable,  int? costoPorKgCentavos,  int? precioPorKgCentavos,  int? stockGramos,  int? stockMinimoGramos,  bool activo)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Product() when $default != null:
return $default(_that.id,_that.sku,_that.barcode,_that.nombre,_that.costoCentavos,_that.precioCentavos,_that.costoEsProvisional,_that.categoryId,_that.providerId,_that.locationId,_that.stock,_that.stockMinimo,_that.esPesable,_that.costoPorKgCentavos,_that.precioPorKgCentavos,_that.stockGramos,_that.stockMinimoGramos,_that.activo);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String sku,  String? barcode,  String nombre,  int costoCentavos,  int precioCentavos,  bool costoEsProvisional,  String categoryId,  String? providerId,  String? locationId,  int stock,  int stockMinimo,  bool esPesable,  int? costoPorKgCentavos,  int? precioPorKgCentavos,  int? stockGramos,  int? stockMinimoGramos,  bool activo)  $default,) {final _that = this;
switch (_that) {
case _Product():
return $default(_that.id,_that.sku,_that.barcode,_that.nombre,_that.costoCentavos,_that.precioCentavos,_that.costoEsProvisional,_that.categoryId,_that.providerId,_that.locationId,_that.stock,_that.stockMinimo,_that.esPesable,_that.costoPorKgCentavos,_that.precioPorKgCentavos,_that.stockGramos,_that.stockMinimoGramos,_that.activo);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String sku,  String? barcode,  String nombre,  int costoCentavos,  int precioCentavos,  bool costoEsProvisional,  String categoryId,  String? providerId,  String? locationId,  int stock,  int stockMinimo,  bool esPesable,  int? costoPorKgCentavos,  int? precioPorKgCentavos,  int? stockGramos,  int? stockMinimoGramos,  bool activo)?  $default,) {final _that = this;
switch (_that) {
case _Product() when $default != null:
return $default(_that.id,_that.sku,_that.barcode,_that.nombre,_that.costoCentavos,_that.precioCentavos,_that.costoEsProvisional,_that.categoryId,_that.providerId,_that.locationId,_that.stock,_that.stockMinimo,_that.esPesable,_that.costoPorKgCentavos,_that.precioPorKgCentavos,_that.stockGramos,_that.stockMinimoGramos,_that.activo);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Product implements Product {
  const _Product({required this.id, required this.sku, this.barcode, required this.nombre, required this.costoCentavos, required this.precioCentavos, this.costoEsProvisional = false, required this.categoryId, this.providerId, this.locationId, this.stock = 0, this.stockMinimo = 0, this.esPesable = false, this.costoPorKgCentavos, this.precioPorKgCentavos, this.stockGramos, this.stockMinimoGramos, this.activo = true});
  factory _Product.fromJson(Map<String, dynamic> json) => _$ProductFromJson(json);

@override final  String id;
@override final  String sku;
@override final  String? barcode;
@override final  String nombre;
@override final  int costoCentavos;
@override final  int precioCentavos;
@override@JsonKey() final  bool costoEsProvisional;
@override final  String categoryId;
@override final  String? providerId;
@override final  String? locationId;
@override@JsonKey() final  int stock;
@override@JsonKey() final  int stockMinimo;
@override@JsonKey() final  bool esPesable;
@override final  int? costoPorKgCentavos;
@override final  int? precioPorKgCentavos;
@override final  int? stockGramos;
@override final  int? stockMinimoGramos;
@override@JsonKey() final  bool activo;

/// Create a copy of Product
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ProductCopyWith<_Product> get copyWith => __$ProductCopyWithImpl<_Product>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ProductToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Product&&(identical(other.id, id) || other.id == id)&&(identical(other.sku, sku) || other.sku == sku)&&(identical(other.barcode, barcode) || other.barcode == barcode)&&(identical(other.nombre, nombre) || other.nombre == nombre)&&(identical(other.costoCentavos, costoCentavos) || other.costoCentavos == costoCentavos)&&(identical(other.precioCentavos, precioCentavos) || other.precioCentavos == precioCentavos)&&(identical(other.costoEsProvisional, costoEsProvisional) || other.costoEsProvisional == costoEsProvisional)&&(identical(other.categoryId, categoryId) || other.categoryId == categoryId)&&(identical(other.providerId, providerId) || other.providerId == providerId)&&(identical(other.locationId, locationId) || other.locationId == locationId)&&(identical(other.stock, stock) || other.stock == stock)&&(identical(other.stockMinimo, stockMinimo) || other.stockMinimo == stockMinimo)&&(identical(other.esPesable, esPesable) || other.esPesable == esPesable)&&(identical(other.costoPorKgCentavos, costoPorKgCentavos) || other.costoPorKgCentavos == costoPorKgCentavos)&&(identical(other.precioPorKgCentavos, precioPorKgCentavos) || other.precioPorKgCentavos == precioPorKgCentavos)&&(identical(other.stockGramos, stockGramos) || other.stockGramos == stockGramos)&&(identical(other.stockMinimoGramos, stockMinimoGramos) || other.stockMinimoGramos == stockMinimoGramos)&&(identical(other.activo, activo) || other.activo == activo));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,sku,barcode,nombre,costoCentavos,precioCentavos,costoEsProvisional,categoryId,providerId,locationId,stock,stockMinimo,esPesable,costoPorKgCentavos,precioPorKgCentavos,stockGramos,stockMinimoGramos,activo);

@override
String toString() {
  return 'Product(id: $id, sku: $sku, barcode: $barcode, nombre: $nombre, costoCentavos: $costoCentavos, precioCentavos: $precioCentavos, costoEsProvisional: $costoEsProvisional, categoryId: $categoryId, providerId: $providerId, locationId: $locationId, stock: $stock, stockMinimo: $stockMinimo, esPesable: $esPesable, costoPorKgCentavos: $costoPorKgCentavos, precioPorKgCentavos: $precioPorKgCentavos, stockGramos: $stockGramos, stockMinimoGramos: $stockMinimoGramos, activo: $activo)';
}


}

/// @nodoc
abstract mixin class _$ProductCopyWith<$Res> implements $ProductCopyWith<$Res> {
  factory _$ProductCopyWith(_Product value, $Res Function(_Product) _then) = __$ProductCopyWithImpl;
@override @useResult
$Res call({
 String id, String sku, String? barcode, String nombre, int costoCentavos, int precioCentavos, bool costoEsProvisional, String categoryId, String? providerId, String? locationId, int stock, int stockMinimo, bool esPesable, int? costoPorKgCentavos, int? precioPorKgCentavos, int? stockGramos, int? stockMinimoGramos, bool activo
});




}
/// @nodoc
class __$ProductCopyWithImpl<$Res>
    implements _$ProductCopyWith<$Res> {
  __$ProductCopyWithImpl(this._self, this._then);

  final _Product _self;
  final $Res Function(_Product) _then;

/// Create a copy of Product
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? sku = null,Object? barcode = freezed,Object? nombre = null,Object? costoCentavos = null,Object? precioCentavos = null,Object? costoEsProvisional = null,Object? categoryId = null,Object? providerId = freezed,Object? locationId = freezed,Object? stock = null,Object? stockMinimo = null,Object? esPesable = null,Object? costoPorKgCentavos = freezed,Object? precioPorKgCentavos = freezed,Object? stockGramos = freezed,Object? stockMinimoGramos = freezed,Object? activo = null,}) {
  return _then(_Product(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,sku: null == sku ? _self.sku : sku // ignore: cast_nullable_to_non_nullable
as String,barcode: freezed == barcode ? _self.barcode : barcode // ignore: cast_nullable_to_non_nullable
as String?,nombre: null == nombre ? _self.nombre : nombre // ignore: cast_nullable_to_non_nullable
as String,costoCentavos: null == costoCentavos ? _self.costoCentavos : costoCentavos // ignore: cast_nullable_to_non_nullable
as int,precioCentavos: null == precioCentavos ? _self.precioCentavos : precioCentavos // ignore: cast_nullable_to_non_nullable
as int,costoEsProvisional: null == costoEsProvisional ? _self.costoEsProvisional : costoEsProvisional // ignore: cast_nullable_to_non_nullable
as bool,categoryId: null == categoryId ? _self.categoryId : categoryId // ignore: cast_nullable_to_non_nullable
as String,providerId: freezed == providerId ? _self.providerId : providerId // ignore: cast_nullable_to_non_nullable
as String?,locationId: freezed == locationId ? _self.locationId : locationId // ignore: cast_nullable_to_non_nullable
as String?,stock: null == stock ? _self.stock : stock // ignore: cast_nullable_to_non_nullable
as int,stockMinimo: null == stockMinimo ? _self.stockMinimo : stockMinimo // ignore: cast_nullable_to_non_nullable
as int,esPesable: null == esPesable ? _self.esPesable : esPesable // ignore: cast_nullable_to_non_nullable
as bool,costoPorKgCentavos: freezed == costoPorKgCentavos ? _self.costoPorKgCentavos : costoPorKgCentavos // ignore: cast_nullable_to_non_nullable
as int?,precioPorKgCentavos: freezed == precioPorKgCentavos ? _self.precioPorKgCentavos : precioPorKgCentavos // ignore: cast_nullable_to_non_nullable
as int?,stockGramos: freezed == stockGramos ? _self.stockGramos : stockGramos // ignore: cast_nullable_to_non_nullable
as int?,stockMinimoGramos: freezed == stockMinimoGramos ? _self.stockMinimoGramos : stockMinimoGramos // ignore: cast_nullable_to_non_nullable
as int?,activo: null == activo ? _self.activo : activo // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
