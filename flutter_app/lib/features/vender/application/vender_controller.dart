import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kiosco_app/core/providers.dart';
import 'package:kiosco_app/features/vender/application/cart_line.dart';
import 'package:kiosco_app/features/vender/data/vender_repository.dart';
import 'package:kiosco_app/models/caja.dart';
import 'package:kiosco_app/models/payment_method.dart';
import 'package:kiosco_app/models/product.dart';

class PagoSeleccionado {
  PagoSeleccionado({required this.medioDePago, required this.montoCentavos});
  final PaymentMethod medioDePago;
  final int montoCentavos;
}

class VenderState {
  const VenderState({
    this.caja,
    this.sesion,
    this.carrito = const [],
    this.descuentoCentavos = 0,
    this.cargandoSesion = true,
    this.error,
    this.ventaEnProceso = false,
  });

  final Caja? caja;
  final CajaSesion? sesion;
  final List<CartLine> carrito;
  final int descuentoCentavos;
  final bool cargandoSesion;
  final String? error;
  final bool ventaEnProceso;

  bool get haySesionAbierta => sesion != null;

  int get subtotalCentavos => carrito.fold(0, (acc, l) => acc + l.subtotalCentavos);

  int get totalCentavos => (subtotalCentavos - descuentoCentavos).clamp(0, subtotalCentavos);

  VenderState copyWith({
    Caja? caja,
    CajaSesion? Function()? sesion,
    List<CartLine>? carrito,
    int? descuentoCentavos,
    bool? cargandoSesion,
    String? Function()? error,
    bool? ventaEnProceso,
  }) {
    return VenderState(
      caja: caja ?? this.caja,
      sesion: sesion != null ? sesion() : this.sesion,
      carrito: carrito ?? this.carrito,
      descuentoCentavos: descuentoCentavos ?? this.descuentoCentavos,
      cargandoSesion: cargandoSesion ?? this.cargandoSesion,
      error: error != null ? error() : this.error,
      ventaEnProceso: ventaEnProceso ?? this.ventaEnProceso,
    );
  }
}

class VenderController extends Notifier<VenderState> {
  late final VenderRepository _repository;

  @override
  VenderState build() {
    _repository = ref.watch(venderRepositoryProvider);
    _init();
    return const VenderState();
  }

  Future<void> _init() async {
    try {
      final cajas = await _repository.listarCajas();
      if (cajas.isEmpty) {
        state = state.copyWith(cargandoSesion: false, error: () => 'No hay ninguna caja configurada');
        return;
      }
      final caja = cajas.first;
      final sesion = await _repository.sesionAbierta(caja.id);
      state = state.copyWith(caja: caja, sesion: () => sesion, cargandoSesion: false);
    } catch (_) {
      state = state.copyWith(cargandoSesion: false, error: () => 'No se pudo cargar el estado de la caja');
    }
  }

  Future<void> abrirCaja(int fondoInicialCentavos) async {
    final caja = state.caja;
    if (caja == null) return;
    try {
      final sesion = await _repository.abrirCaja(caja.id, fondoInicialCentavos: fondoInicialCentavos);
      state = state.copyWith(sesion: () => sesion, error: () => null);
    } on VenderException catch (e) {
      state = state.copyWith(error: () => e.mensaje);
    }
  }

  Future<bool> cerrarCaja(int efectivoContadoCentavos, {String? nota}) async {
    final sesion = state.sesion;
    if (sesion == null) return false;
    try {
      await _repository.cerrarCaja(sesion.id, efectivoContadoCentavos: efectivoContadoCentavos, nota: nota);
      state = state.copyWith(sesion: () => null, carrito: [], error: () => null);
      return true;
    } on VenderException catch (e) {
      state = state.copyWith(error: () => e.mensaje);
      return false;
    }
  }

  void agregarProducto(Product product, {int cantidad = 1, int? gramos}) {
    final existente = state.carrito.indexWhere((l) => l.product.id == product.id);
    if (existente >= 0 && !product.esPesable) {
      final actualizado = [...state.carrito];
      final linea = actualizado[existente];
      actualizado[existente] = linea.copyWith(cantidad: linea.cantidad + cantidad);
      state = state.copyWith(carrito: actualizado);
      return;
    }
    state = state.copyWith(
      carrito: [...state.carrito, CartLine(product: product, cantidad: cantidad, gramos: gramos)],
    );
  }

  void quitarLinea(int index) {
    final actualizado = [...state.carrito]..removeAt(index);
    state = state.copyWith(carrito: actualizado);
  }

  void setDescuento(int centavos) {
    state = state.copyWith(descuentoCentavos: centavos);
  }

  void limpiarCarrito() {
    state = state.copyWith(carrito: [], descuentoCentavos: 0);
  }

  Future<String?> confirmarVenta(List<PagoSeleccionado> pagos) async {
    if (state.carrito.isEmpty) return null;
    state = state.copyWith(ventaEnProceso: true, error: () => null);
    try {
      final ventaId = await _repository.crearVenta(
        lineas: state.carrito
            .map((l) => {
                  'productId': l.product.id,
                  'cantidad': l.cantidad,
                  if (l.gramos != null) 'gramos': l.gramos,
                })
            .toList(),
        pagos: pagos
            .map((p) => {'paymentMethodId': p.medioDePago.id, 'montoCentavos': p.montoCentavos})
            .toList(),
        descuentoCentavos: state.descuentoCentavos,
      );
      limpiarCarrito();
      state = state.copyWith(ventaEnProceso: false);
      return ventaId;
    } on VenderException catch (e) {
      state = state.copyWith(ventaEnProceso: false, error: () => e.mensaje);
      return null;
    }
  }
}

final venderControllerProvider = NotifierProvider<VenderController, VenderState>(VenderController.new);

final mediosDePagoProvider = FutureProvider((ref) {
  return ref.watch(venderRepositoryProvider).listarMediosDePago();
});
