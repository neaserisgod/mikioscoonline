import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kiosco_app/core/providers.dart';
import 'package:kiosco_app/features/config/data/config_repository.dart';

class NegocioScreen extends ConsumerStatefulWidget {
  const NegocioScreen({super.key});

  @override
  ConsumerState<NegocioScreen> createState() => _NegocioScreenState();
}

class _NegocioScreenState extends ConsumerState<NegocioScreen> {
  final _nombreController = TextEditingController();
  final _cuitController = TextEditingController();
  bool _cargando = true;
  bool _guardando = false;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    final data = await ref.read(configRepositoryProvider).obtenerNegocio();
    _nombreController.text = data['nombre'] as String? ?? '';
    _cuitController.text = data['cuit'] as String? ?? '';
    if (mounted) setState(() => _cargando = false);
  }

  Future<void> _guardar() async {
    setState(() => _guardando = true);
    try {
      await ref.read(configRepositoryProvider).actualizarNegocio({
        'nombre': _nombreController.text.trim(),
        'cuit': _cuitController.text.trim().isEmpty ? null : _cuitController.text.trim(),
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Guardado')));
    } on ConfigException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.mensaje)));
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  @override
  void dispose() {
    _nombreController.dispose();
    _cuitController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_cargando) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Negocio')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 400),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(controller: _nombreController, decoration: const InputDecoration(labelText: 'Nombre')),
              const SizedBox(height: 12),
              TextField(controller: _cuitController, decoration: const InputDecoration(labelText: 'CUIT')),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _guardando ? null : _guardar,
                child: _guardando
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Guardar'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
