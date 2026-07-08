import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kiosco_app/features/auth/application/auth_controller.dart';
import 'package:kiosco_app/features/auth/presentation/login_screen.dart';
import 'package:kiosco_app/features/config/presentation/categorias_screen.dart';
import 'package:kiosco_app/features/config/presentation/config_screen.dart';
import 'package:kiosco_app/features/config/presentation/gastos_fijos_screen.dart';
import 'package:kiosco_app/features/config/presentation/medios_pago_screen.dart';
import 'package:kiosco_app/features/config/presentation/negocio_screen.dart';
import 'package:kiosco_app/features/config/presentation/proveedores_screen.dart';
import 'package:kiosco_app/features/config/presentation/ubicaciones_screen.dart';
import 'package:kiosco_app/features/config/presentation/usuarios_screen.dart';
import 'package:kiosco_app/features/inicio/home_screen.dart';
import 'package:kiosco_app/features/productos/presentation/productos_screen.dart';
import 'package:kiosco_app/features/rentabilidad/presentation/rentabilidad_screen.dart';
import 'package:kiosco_app/features/vender/presentation/vender_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authControllerProvider);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: _AuthStateListenable(ref),
    redirect: (context, state) {
      // Mientras se restaura la sesión guardada al abrir la app, no redirigir
      // todavía — evita un flash de login screen si en realidad hay sesión.
      if (authState.isLoading) return null;

      final haySesion = authState.value != null;
      final vaAlLogin = state.matchedLocation == '/login';

      if (!haySesion && !vaAlLogin) return '/login';
      if (haySesion && vaAlLogin) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(path: '/', builder: (context, state) => const HomeScreen()),
      GoRoute(path: '/vender', builder: (context, state) => const VenderScreen()),
      GoRoute(path: '/productos', builder: (context, state) => const ProductosScreen()),
      GoRoute(path: '/config', builder: (context, state) => const ConfigScreen()),
      GoRoute(path: '/config/negocio', builder: (context, state) => const NegocioScreen()),
      GoRoute(path: '/config/categorias', builder: (context, state) => const CategoriasScreen()),
      GoRoute(path: '/config/proveedores', builder: (context, state) => const ProveedoresScreen()),
      GoRoute(path: '/config/ubicaciones', builder: (context, state) => const UbicacionesScreen()),
      GoRoute(path: '/config/medios-pago', builder: (context, state) => const MediosPagoScreen()),
      GoRoute(path: '/config/gastos-fijos', builder: (context, state) => const GastosFijosScreen()),
      GoRoute(path: '/config/usuarios', builder: (context, state) => const UsuariosScreen()),
      GoRoute(path: '/rentabilidad', builder: (context, state) => const RentabilidadScreen()),
    ],
  );
});

/// go_router necesita un Listenable para saber cuándo re-evaluar `redirect`
/// — lo conectamos a los cambios del authControllerProvider.
class _AuthStateListenable extends ChangeNotifier {
  _AuthStateListenable(Ref ref) {
    ref.listen(authControllerProvider, (_, _) => notifyListeners());
  }
}
