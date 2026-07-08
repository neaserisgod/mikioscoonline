import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kiosco_app/main.dart';

void main() {
  // flutter_secure_storage habla con el SO por platform channel — no existe
  // en el entorno de test, hay que mockearlo para que AuthController.build()
  // pueda resolver (sin esto queda colgado esperando una respuesta que nunca llega).
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');

  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      channel,
      (call) async => call.method == 'readAll' ? <String, String>{} : null,
    );
  });

  testWidgets('la app arranca y muestra el login sin sesión', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: KioscoApp()));
    await tester.pumpAndSettle();

    expect(find.text('Ingresá a tu cuenta'), findsOneWidget);
  });
}
