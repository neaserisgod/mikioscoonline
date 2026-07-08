import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:kiosco_app/core/network/api_config.dart';

class GoogleAuthCode {
  GoogleAuthCode({required this.code, required this.codeVerifier, required this.redirectUri});
  final String code;
  final String codeVerifier;
  final String redirectUri;
}

class GoogleOAuthException implements Exception {
  GoogleOAuthException(this.mensaje);
  final String mensaje;
}

/// Puerto fijo — tiene que coincidir con el redirect URI autorizado en Google
/// Cloud Console para este Client ID (no puede ser dinámico: Google exige
/// coincidencia exacta de redirect_uri, no solo del host).
const int _callbackPort = 8971;

class GoogleOAuthService {
  String _generarCodeVerifier() {
    final random = Random.secure();
    final bytes = List<int>.generate(64, (_) => random.nextInt(256));
    return base64UrlEncode(bytes).replaceAll('=', '');
  }

  String _codeChallengeDe(String verifier) {
    final hash = sha256.convert(utf8.encode(verifier));
    return base64UrlEncode(hash.bytes).replaceAll('=', '');
  }

  /// Abre el navegador del sistema, espera el redirect con el `code` y lo
  /// devuelve junto con el code_verifier (necesario para el intercambio
  /// server-side en /api/auth/mobile-google).
  Future<GoogleAuthCode> iniciarSesion() async {
    final codeVerifier = _generarCodeVerifier();
    final codeChallenge = _codeChallengeDe(codeVerifier);
    final redirectUri = 'http://localhost:$_callbackPort/callback';

    final authUrl = Uri.https('accounts.google.com', '/o/oauth2/v2/auth', {
      'client_id': googleClientId,
      'redirect_uri': redirectUri,
      'response_type': 'code',
      'scope': 'openid email profile',
      'code_challenge': codeChallenge,
      'code_challenge_method': 'S256',
      'prompt': 'select_account',
    });

    late final HttpServer server;
    try {
      server = await HttpServer.bind(InternetAddress.loopbackIPv4, _callbackPort);
    } catch (_) {
      throw GoogleOAuthException('El puerto $_callbackPort ya está en uso. Cerrá otras instancias de la app.');
    }

    if (!await launchUrl(authUrl, mode: LaunchMode.externalApplication)) {
      await server.close(force: true);
      throw GoogleOAuthException('No se pudo abrir el navegador');
    }

    try {
      final request = await server.first.timeout(
        const Duration(minutes: 3),
        onTimeout: () => throw GoogleOAuthException('Tiempo de espera agotado'),
      );

      final params = request.uri.queryParameters;
      final error = params['error'];
      final code = params['code'];

      request.response
        ..statusCode = 200
        ..headers.contentType = ContentType.html
        ..write(_paginaDeCierre(exito: error == null && code != null));
      await request.response.close();

      if (error != null || code == null) {
        throw GoogleOAuthException('Google no autorizó el login');
      }

      return GoogleAuthCode(code: code, codeVerifier: codeVerifier, redirectUri: redirectUri);
    } finally {
      await server.close(force: true);
    }
  }

  String _paginaDeCierre({required bool exito}) {
    final mensaje = exito ? 'Listo, ya podés volver a la app.' : 'Algo salió mal. Volvé a la app e intentá de nuevo.';
    return '<html><body style="font-family: sans-serif; text-align: center; padding-top: 80px;">'
        '<h2>$mensaje</h2></body></html>';
  }
}
