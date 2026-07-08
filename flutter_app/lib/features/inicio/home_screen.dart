import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kiosco_app/features/auth/application/auth_controller.dart';
import 'package:kiosco_app/models/usuario.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usuario = ref.watch(authControllerProvider).value;
    final esAdmin = usuario?.role == Role.admin;

    final items = [
      ('Vender', '/vender', Icons.point_of_sale),
      if (esAdmin) ('Productos', '/productos', Icons.inventory_2),
      if (esAdmin) ('Rentabilidad', '/rentabilidad', Icons.trending_up),
      if (esAdmin) ('Config', '/config', Icons.settings),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Kiosco'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Cerrar sesión',
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text('Hola, ${usuario?.nombre ?? ''}', style: Theme.of(context).textTheme.headlineSmall),
          ),
          Expanded(
            child: GridView.count(
              crossAxisCount: 2,
              padding: const EdgeInsets.all(16),
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
              children: items
                  .map((i) => Card(
                        child: InkWell(
                          onTap: () => context.push(i.$2),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(i.$3, size: 40),
                              const SizedBox(height: 8),
                              Text(i.$1),
                            ],
                          ),
                        ),
                      ))
                  .toList(),
            ),
          ),
        ],
      ),
    );
  }
}
