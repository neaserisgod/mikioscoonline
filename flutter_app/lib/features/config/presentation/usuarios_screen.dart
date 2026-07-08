import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kiosco_app/core/providers.dart';
import 'package:kiosco_app/features/config/data/config_repository.dart';

class UsuariosScreen extends ConsumerStatefulWidget {
  const UsuariosScreen({super.key});

  @override
  ConsumerState<UsuariosScreen> createState() => _UsuariosScreenState();
}

class _UsuariosScreenState extends ConsumerState<UsuariosScreen> {
  List<Map<String, dynamic>>? _items;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    final items = await ref.read(configRepositoryProvider).listarUsuarios();
    if (mounted) setState(() => _items = items);
  }

  Future<void> _crearUsuario() async {
    final nombreController = TextEditingController();
    final emailController = TextEditingController();
    final passwordController = TextEditingController();
    String role = 'VENDEDOR';

    final guardar = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: const Text('Nuevo usuario'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: nombreController, decoration: const InputDecoration(labelText: 'Nombre')),
              TextField(controller: emailController, decoration: const InputDecoration(labelText: 'Email')),
              TextField(
                controller: passwordController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Contraseña (mín. 6)'),
              ),
              const SizedBox(height: 8),
              DropdownButton<String>(
                value: role,
                items: const [
                  DropdownMenuItem(value: 'VENDEDOR', child: Text('Vendedor')),
                  DropdownMenuItem(value: 'ADMIN', child: Text('Admin')),
                ],
                onChanged: (v) => setState(() => role = v ?? 'VENDEDOR'),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
            FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Crear')),
          ],
        ),
      ),
    );
    if (guardar != true) return;

    try {
      await ref.read(configRepositoryProvider).crearUsuario({
        'nombre': nombreController.text.trim(),
        'email': emailController.text.trim(),
        'password': passwordController.text,
        'role': role,
      });
      await _cargar();
    } on ConfigException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
  }

  Future<void> _cambiar(String id, Map<String, dynamic> data) async {
    try {
      await ref.read(configRepositoryProvider).editarUsuario(id, data);
      await _cargar();
    } on ConfigException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Usuarios')),
      floatingActionButton: FloatingActionButton(onPressed: _crearUsuario, child: const Icon(Icons.add)),
      body: _items == null
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _items!.length,
              itemBuilder: (context, index) {
                final item = _items![index];
                final activo = item['activo'] as bool? ?? true;
                final role = item['role'] as String;
                return ListTile(
                  title: Text(item['nombre'] as String),
                  subtitle: Text('${item['email']} · $role${activo ? '' : ' · Inactivo'}'),
                  trailing: PopupMenuButton<String>(
                    onSelected: (v) {
                      if (v == 'toggle') _cambiar(item['id'] as String, {'activo': !activo});
                      if (v == 'rol') {
                        _cambiar(item['id'] as String, {'role': role == 'ADMIN' ? 'VENDEDOR' : 'ADMIN'});
                      }
                    },
                    itemBuilder: (context) => [
                      PopupMenuItem(value: 'toggle', child: Text(activo ? 'Desactivar' : 'Reactivar')),
                      PopupMenuItem(value: 'rol', child: Text(role == 'ADMIN' ? 'Cambiar a Vendedor' : 'Cambiar a Admin')),
                    ],
                  ),
                );
              },
            ),
    );
  }
}
