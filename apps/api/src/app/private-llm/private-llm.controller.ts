import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { Public } from '../auth/public.decorator.js';

type HandshakeBody = {
  challenge_id?: string;
  request_id?: string;
  demo_name?: string;
  expected_gateway_path?: string;
};

type HandshakeResponse = {
  ok: boolean;
  challenge_id?: string;
  request_id?: string;
  demo_name?: string;
  gateway?: unknown;
  error?: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for private Mac handshake`);
  return value;
}

function requestId(
  headersRequestId: string | undefined,
  body: HandshakeBody,
): string {
  return body.request_id ?? headersRequestId ?? crypto.randomUUID();
}

@ApiTags('Private LLM')
@Controller({ path: 'private-llm-handshake', version: '1' })
@Public()
export class PrivateLlmController {
  @Post()
  @ApiOperation({
    summary: 'Remote demo handshake hacia el private Mac gateway.',
  })
  @ApiResponse({
    status: 200,
    description: 'El demo remoto alcanzó el gateway privado de la Mac.',
  })
  async handshake(
    @Req() request: Request,
    @Body() body: HandshakeBody,
    @Headers('x-private-llm-handshake-challenge') headerChallenge?: string,
    @Headers('x-request-id') headerRequestId?: string,
    @Headers('x-demo-name') headerDemoName?: string,
  ): Promise<HandshakeResponse> {
    const challengeId = body.challenge_id ?? headerChallenge ?? '';
    if (!challengeId.trim()) {
      return { ok: false, error: 'challenge_id is required' };
    }

    const demoName =
      body.demo_name ??
      headerDemoName ??
      process.env.PRIVATE_LLM_DEMO_NAME ??
      'demo-bank';
    const id = requestId(headerRequestId, body);
    const baseUrl = requiredEnv('PRIVATE_LLM_BASE_URL').replace(/\/$/, '');
    const apiKey = requiredEnv('PRIVATE_LLM_API_KEY');

    const gatewayResponse = await fetch(
      `${baseUrl}/v1/private-gateway/handshake`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'x-demo-name': demoName,
          'x-request-id': id,
        },
        body: JSON.stringify({
          challenge_id: challengeId,
          source: 'remote-demo',
          remote_url: `${request.protocol}://${request.get('host')}${request.originalUrl}`,
        }),
      },
    );
    const gateway = await gatewayResponse.json().catch(() => null);
    if (!gatewayResponse.ok) {
      return {
        ok: false,
        challenge_id: challengeId,
        request_id: id,
        demo_name: demoName,
        gateway,
        error: `Private Mac gateway returned HTTP ${gatewayResponse.status}`,
      };
    }

    return {
      ok: true,
      challenge_id: challengeId,
      request_id: id,
      demo_name: demoName,
      gateway,
    };
  }
}
