import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kiosco_app/core/providers.dart';
import 'package:kiosco_app/features/config/presentation/simple_entity_screen.dart';

class ProveedoresScreen extends ConsumerWidget {
  const ProveedoresScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repo = ref.watch(configRepositoryProvider);
    return SimpleEntityScreen(
      titulo: 'Proveedores',
      listar: repo.listarProveedores,
      crear: repo.crearProveedor,
      editar: (id, nombre) => repo.editarProveedor(id, {'nombre': nombre}),
      eliminar: repo.eliminarProveedor,
    );
  }
}
