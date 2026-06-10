// -----------------------------------------------------------------------------
// NotarizeModule — Demo 08 (notarización cooperativa con IA).
//
// Construye los dos NotaryAdapter (local + polygon) a partir de las env vars
// validadas en env.schema.ts y los inyecta al service vía DI tokens.
//
// El consumer del package `@org/notary-adapter` (esto) ES el único punto
// del backend que importa `ethers` directamente. El package se mantiene
// agnóstico — recibe un signer estructural.
// -----------------------------------------------------------------------------

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@org/db';
import {
  LocalNotaryAdapter,
  PolygonNotaryAdapter,
  type LocalNotaryDb,
  type PolygonProvider,
  type PolygonSigner,
} from '@org/notary-adapter';
import { JsonRpcProvider, Wallet } from 'ethers';

import { PdfTextExtractor } from '../ingest/pdf-text-extractor.js';

import { NotarizeController } from './notarize.controller.js';
import {
  LOCAL_NOTARY,
  NotarizeService,
  POLYGON_NOTARY,
} from './notarize.service.js';

@Module({
  controllers: [NotarizeController],
  providers: [
    NotarizeService,
    PdfTextExtractor,
    // -----------------------------------------------------------------------
    // LocalNotaryAdapter — usa el cliente prisma global.
    //
    // El cliente prisma matchea estructuralmente con `LocalNotaryDb` del
    // package — los campos del schema (LocalAnchor, TenantNotaryKey) están
    // tipados igual.
    // -----------------------------------------------------------------------
    {
      provide: LOCAL_NOTARY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const masterKey = config.get<string>('NOTARY_MASTER_KEY');
        if (!masterKey) {
          throw new Error(
            'NOTARY_MASTER_KEY no está definida — el demo 08 no puede arrancar.',
          );
        }
        return new LocalNotaryAdapter({
          db: prisma as unknown as LocalNotaryDb,
          masterKey,
        });
      },
    },
    // -----------------------------------------------------------------------
    // PolygonNotaryAdapter — construye ethers.Wallet con env vars.
    //
    // Si POLYGON_WALLET_KEY no está, devolvemos un adapter "broken" que
    // lanza al primer anchor — más útil que crashear el boot del server.
    // El user del demo verá un anchor 'failed' con razón clara.
    // -----------------------------------------------------------------------
    {
      provide: POLYGON_NOTARY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const rpcUrl =
          config.get<string>('POLYGON_RPC_URL') ??
          'https://rpc-amoy.polygon.technology';
        const walletKey = config.get<string>('POLYGON_WALLET_KEY');
        const network = config.get<string>('POLYGON_NETWORK') ?? 'polygon-amoy';

        if (!walletKey) {
          // Adapter "broken" — registramos uno que lanza al usarse. El
          // demo arranca igual; solo el modo 'public' o 'both' falla con
          // 'POLYGON_WALLET_KEY no configurada'. El modo 'local' sigue
          // funcionando.
          const broken: PolygonSigner = {
            async getAddress() {
              throw new Error('POLYGON_WALLET_KEY no configurada en el env');
            },
            async sendTransaction() {
              throw new Error('POLYGON_WALLET_KEY no configurada en el env');
            },
            provider: brokenProvider(),
          };
          return new PolygonNotaryAdapter({ signer: broken, network });
        }

        const provider = new JsonRpcProvider(rpcUrl);
        const wallet = new Wallet(walletKey, provider);
        return new PolygonNotaryAdapter({
          signer: wallet as unknown as PolygonSigner,
          network,
        });
      },
    },
  ],
})
export class NotarizeModule {}

function brokenProvider(): PolygonProvider {
  return {
    async getTransaction() {
      throw new Error('POLYGON_WALLET_KEY no configurada en el env');
    },
  };
}
