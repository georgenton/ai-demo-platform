// -----------------------------------------------------------------------------
// DTO del POST /api/v1/auth/login.
//
// Validamos email + password con class-validator. La contraseña real
// se compara con bcrypt en el AuthService, nunca se loguea ni se devuelve.
// -----------------------------------------------------------------------------

import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Email del usuario. Sirve como identificador único.',
    example: 'admin@cliente.com',
  })
  @IsEmail({}, { message: 'Email inválido.' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    description:
      'Contraseña en texto plano. Se compara contra el hash bcrypt almacenado.',
    minLength: 8,
    example: 'una-contrasena-segura',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, {
    message: 'La contraseña debe tener al menos 8 caracteres.',
  })
  @MaxLength(128)
  password!: string;
}
