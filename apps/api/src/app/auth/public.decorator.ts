// -----------------------------------------------------------------------------
// @Public() — marca un controller o handler como exento del AuthGuard global.
//
// Uso:
//   @Public()
//   @Post('login')
//   login(...) { ... }
//
// El AuthGuard global usa Reflector para detectar la metadata IS_PUBLIC_KEY
// y devuelve `true` sin verificar token cuando está presente. Sin esta
// metadata, el guard exige JWT válido.
// -----------------------------------------------------------------------------

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
