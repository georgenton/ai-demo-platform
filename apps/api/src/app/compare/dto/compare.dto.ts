// -----------------------------------------------------------------------------
// DTOs del endpoint POST /api/v1/compare.
//
// El ValidationPipe global aplica decoradores automáticamente; si el body no
// cumple, NestJS responde 400 con el detalle.
// -----------------------------------------------------------------------------

import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CompareRequestDto {
  /**
   * IDs de los documentos a comparar. 2 mínimo (la cosa más chica que se
   * puede comparar es un par), 5 máximo. El tope superior es pragmático:
   * con más de 5 documentos el prompt se vuelve incómodo de leer y el
   * costo del LLM se dispara.
   */
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  documentIds!: string[];

  /**
   * Dimensiones a comparar — los ejes que el LLM tiene que cruzar entre los
   * documentos. Ejemplos: "cláusulas de penalización", "plazo de entrega",
   * "responsabilidades del proveedor".
   *
   * 1 mínimo (sin dimensiones no hay comparación), 10 máximo (más que eso
   * vuelve la respuesta inmanejable y suele ser señal de que el usuario
   * quiere un resumen general, no una comparación dirigida).
   */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(200, { each: true })
  dimensions!: string[];

  /**
   * Demo de origen (filtro opcional). Por ahora informativo — los
   * documentIds ya son suficientes para fetch. Cuando agreguemos
   * authorization por demo, se valida que los documentIds pertenezcan al
   * demoId reclamado.
   */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  demoId?: string;
}
