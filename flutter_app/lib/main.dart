import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kiosco_app/core/router/app_router.dart';
import 'package:kiosco_app/core/theme/app_theme.dart';

void main() {
  runApp(const ProviderScope(child: KioscoApp()));
}

class KioscoApp extends ConsumerWidget {
  const KioscoApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'Kiosco',
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      routerConfig: router,
    );
  }
}
