import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ConfigScreen extends StatelessWidget {
  const ConfigScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final items = [
      ('Negocio', '/config/negocio', Icons.store),
      ('Categorías', '/config/categorias', Icons.category),
      ('Proveedores', '/config/proveedores', Icons.local_shipping),
      ('Ubicaciones', '/config/ubicaciones', Icons.place),
      ('Medios de pago', '/config/medios-pago', Icons.payments),
      ('Gastos fijos', '/config/gastos-fijos', Icons.receipt_long),
      ('Usuarios', '/config/usuarios', Icons.people),
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Config')),
      body: ListView(
        children: items
            .map((i) => ListTile(
                  leading: Icon(i.$3),
                  title: Text(i.$1),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push(i.$2),
                ))
            .toList(),
      ),
    );
  }
}
