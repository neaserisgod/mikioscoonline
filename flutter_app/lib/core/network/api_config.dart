/// URL base de la API (el backend Next.js ya deployado en Vercel).
///
/// Durante desarrollo apunta a `next dev` local; para producción reemplazar
/// por la URL real del deploy antes de compilar el instalador del kiosco.
/// TODO(bruno): confirmar la URL de producción y setearla acá.
const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:3000',
);

/// Mismo Client ID que usa NextAuth en la web (src/auth.ts) — el Client ID no
/// es secreto, es seguro embeberlo en el binario. El Client Secret NUNCA viaja
/// acá: el intercambio code→token pasa por /api/auth/mobile-google, server-side.
///
/// El puerto 8971 del redirect_uri (ver google_oauth_service.dart) tiene que
/// estar registrado como "Authorized redirect URI" en Google Cloud Console
/// para este Client ID — es un paso manual único, no lo puede hacer el agente.
const String googleClientId =
    '756896078661-26l07sdnbjv75b14ao0e2bi69sijprnq.apps.googleusercontent.com';
