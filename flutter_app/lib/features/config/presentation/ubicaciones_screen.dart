import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kiosco_app/core/providers.dart';
import 'package:kiosco_app/features/config/presentation/simple_entity_screen.dart';

class UbicacionesScreen extends ConsumerWidget {
  const UbicacionesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repo = ref.watch(configRepositoryProvider);
    return SimpleEntityScreen(
      titulo: 'Ubicaciones',
      listar: repo.listarUbicaciones,
      crear: repo.crearUbicacion,
      editar: (id, nombre) => repo.editarUbicacion(id, {'nombre': nombre}),
      eliminar: repo.eliminarUbicacion,
    );
  }
}
