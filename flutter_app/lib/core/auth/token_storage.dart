import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Guarda el JWT del login (ver /api/auth/mobile-login en el backend) y los
/// datos del usuario en el almacenamiento seguro del SO (Credential Manager
/// en Windows, Keystore en Android) — no en SharedPreferences, que no está
/// cifrado. Guardamos el usuario aparte del token para no tener que decodificar
/// el JWT en el cliente solo para restaurar la sesión al abrir la app.
class TokenStorage {
  TokenStorage(this._storage);

  final FlutterSecureStorage _storage;
  static const _tokenKey = 'auth_token';
  static const _userKey = 'auth_user';

  Future<String?> readToken() => _storage.read(key: _tokenKey);

  Future<String?> readUserJson() => _storage.read(key: _userKey);

  Future<void> save({required String token, required String userJson}) async {
    await _storage.write(key: _tokenKey, value: token);
    await _storage.write(key: _userKey, value: userJson);
  }

  Future<void> clear() async {
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _userKey);
  }
}
